"""
Morocco Drought SPI Pipeline - May 2026
Data    : ERA5-Land via Open-Meteo (1981 -> today, free, no key)
          + ENSO ONI index from NOAA (teleconnexion Maroc)
Target  : SPI-3 T+1, T+2, T+3 par bassin
Models  : Climatologie | Persistance | Ridge | RF | XGB | LGB -> Ensemble
          Time-series walk-forward cross-validation (5 folds)
Output  : web/public/predictions.json
"""

import json, os, sys, io, time
import numpy as np
import pandas as pd
import requests
from datetime import date, timedelta
from scipy import stats
from sklearn.linear_model import Ridge
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score, f1_score, precision_score, recall_score
import xgboost as xgb
import lightgbm as lgb

# ── Dates dynamiques ────────────────────────────────────────────────────────
START_DATE = "1981-01-01"
END_DATE   = date.today().strftime("%Y-%m-%d")   # aujourd'hui
TODAY_STR  = date.today().strftime("%Y-%m-%d")

BASINS = [
    {"name": "Loukkos",       "lat": 35.1, "lon": -5.8,  "area_km2": 3620},
    {"name": "Tangerois",     "lat": 35.6, "lon": -5.5,  "area_km2": 1380},
    {"name": "Moulouya",      "lat": 33.8, "lon": -3.5,  "area_km2": 51600},
    {"name": "Sebou",         "lat": 34.1, "lon": -5.5,  "area_km2": 40000},
    {"name": "Bouregreg",     "lat": 33.5, "lon": -6.6,  "area_km2": 9950},
    {"name": "Oum Er-Rbia",   "lat": 32.6, "lon": -7.2,  "area_km2": 35000},
    {"name": "Tensift",       "lat": 31.3, "lon": -8.2,  "area_km2": 19800},
    {"name": "Souss-Massa",   "lat": 30.2, "lon": -9.2,  "area_km2": 25400},
    {"name": "Draa-Ziz-Guir", "lat": 30.5, "lon": -5.0,  "area_km2": 111000},
]

CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_cache")
OUT_JSON  = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                         "..", "web", "public", "predictions.json")
os.makedirs(CACHE_DIR, exist_ok=True)


# ── 1. ENSO ONI (NOAA) ─────────────────────────────────────────────────────
def fetch_enso():
    """
    Fetches the NOAA Oceanic Nino Index (ONI) - trimestrial.
    Returns a monthly DataFrame with columns [year, month, oni].
    """
    cache = os.path.join(CACHE_DIR, "oni.csv")
    if os.path.exists(cache):
        try:
            df = pd.read_csv(cache)
            if len(df) > 100:
                sys.stderr.write("  [cache] ONI ENSO\n")
                return df
        except Exception:
            pass
        os.remove(cache)

    url = "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt"
    SEASON_MAP = {"DJF":1,"JFM":2,"FMA":3,"MAM":4,"AMJ":5,"MJJ":6,
                  "JJA":7,"JAS":8,"ASO":9,"SON":10,"OND":11,"NDJ":12}
    try:
        r = requests.get(url, timeout=30)
        r.raise_for_status()
        rows = []
        for line in r.text.strip().split("\n"):
            parts = line.split()
            if len(parts) < 3: continue
            try:
                yr  = int(parts[0])
                mon = SEASON_MAP.get(parts[1], None)
                if mon is None: continue
                oni_val = float(parts[2])
                rows.append({"year": yr, "month": mon, "oni": oni_val})
            except (ValueError, IndexError):
                continue
        df = pd.DataFrame(rows).drop_duplicates(["year","month"])
        df.to_csv(cache, index=False)
        sys.stderr.write(f"  [fetch] ONI ENSO {len(df)} records\n")
        return df
    except Exception as e:
        sys.stderr.write(f"  [warn] ONI fetch failed: {e} - using zeros\n")
        return pd.DataFrame({"year": [], "month": [], "oni": []})


# ── 2. ERA5-Land fetch ──────────────────────────────────────────────────────
def fetch_basin(basin, retries=5):
    safe  = basin["name"].replace(" ","_").replace("'","")
    cache = os.path.join(CACHE_DIR, f"{safe}.csv")

    if os.path.exists(cache):
        df = pd.read_csv(cache, parse_dates=["date"])
        latest = df["date"].max()
        cutoff = pd.Timestamp(date.today() - timedelta(days=7))
        if latest >= cutoff:
            sys.stderr.write(f"  [cache] {basin['name']} -> {latest.date()}\n")
            return df
        os.remove(cache)
        sys.stderr.write(f"  [stale] {basin['name']} ({latest.date()}) - refetch\n")

    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": basin["lat"], "longitude": basin["lon"],
        "start_date": START_DATE, "end_date": END_DATE,
        "daily": "precipitation_sum,temperature_2m_mean,et0_fao_evapotranspiration",
        "timezone": "UTC",
    }
    for attempt in range(retries):
        try:
            time.sleep(10)
            r = requests.get(url, params=params, timeout=120)
            r.raise_for_status()
            d = r.json()
            df = pd.DataFrame({
                "date":   pd.to_datetime(d["daily"]["time"]),
                "precip": d["daily"]["precipitation_sum"],
                "temp":   d["daily"]["temperature_2m_mean"],
                "et0":    d["daily"]["et0_fao_evapotranspiration"],
            })
            df.to_csv(cache, index=False)
            sys.stderr.write(f"  [fetch] {basin['name']} -> {df['date'].max().date()} ({len(df)} days)\n")
            return df
        except Exception as e:
            wait = 30*(attempt+1)
            sys.stderr.write(f"  [retry {attempt+1}] {e} - wait {wait}s\n")
            time.sleep(wait)
    raise RuntimeError(f"Cannot fetch {basin['name']}")


# ── 3. Daily -> Monthly ─────────────────────────────────────────────────────
def to_monthly(df):
    df = df.copy()
    df["year"]  = df["date"].dt.year
    df["month"] = df["date"].dt.month
    m = df.groupby(["year","month"]).agg(
        precip=("precip","sum"), temp=("temp","mean"),
        et0=("et0","sum"), n=("precip","count"),
    ).reset_index()
    complete = m[m["n"] >= 20].copy()      # mois complets (>= 20 jours)
    partial  = m[(m["n"] > 0) & (m["n"] < 20)].copy()  # mois en cours
    complete["date"] = pd.to_datetime(complete[["year","month"]].assign(day=1))
    complete["precip"] = complete["precip"].clip(lower=0)
    complete["et0"]    = complete["et0"].clip(lower=0)
    return (
        complete.sort_values("date").reset_index(drop=True),
        partial.tail(1).reset_index(drop=True),   # dernier mois partiel
    )


# ── 4. SPI (methode gamma WMO) ──────────────────────────────────────────────
def compute_spi(series, scale=3):
    p = series.copy().clip(lower=0.001)
    rolling = p.rolling(scale, min_periods=scale).sum()
    spi = np.full(len(rolling), np.nan)
    for m in range(1, 13):
        idx  = [i for i in range(len(rolling)) if (i % 12) == ((m-1) % 12)]
        vals = rolling.iloc[idx].dropna().values
        if len(vals) < 20:
            continue
        try:
            a, loc, sc2 = stats.gamma.fit(vals, floc=0)
            cdf = stats.gamma.cdf(
                rolling.iloc[idx].fillna(np.nanmean(vals)).values,
                a, loc=loc, scale=sc2)
            spi[idx] = stats.norm.ppf(np.clip(cdf, 0.002, 0.998))
        except Exception:
            continue
    return spi


# ── 5. Feature engineering ──────────────────────────────────────────────────
FEAT = [
    "persist",
    "spi3_lag1","spi3_lag2","spi3_lag3","spi3_lag6","spi3_lag12",
    "spi6_lag1",
    "precip_lag1","precip_lag2","precip_lag3",
    "precip_roll3","precip_roll6","precip_roll12","precip_std12",
    "temp_roll3","et0_roll3",
    "precip_anom",
    "sin1","cos1","sin2","cos2",
    "trend6",
    "clim_spi",
    "oni_lag1","oni_lag3",     # ENSO teleconnexion
]

def build_features(monthly, oni_df, lead=3):
    df = monthly.copy()
    df["spi3"] = compute_spi(df["precip"], scale=3)
    df["spi6"] = compute_spi(df["precip"], scale=6)
    df = df.dropna(subset=["spi3","spi6"]).reset_index(drop=True)

    # Merge ONI
    if len(oni_df) > 10:
        df = df.merge(oni_df[["year","month","oni"]], on=["year","month"], how="left")
        df["oni"] = df["oni"].interpolate(limit=3).fillna(0)
    else:
        df["oni"] = 0.0

    # Lag features
    for lag in [1,2,3,6,12]:
        df[f"spi3_lag{lag}"] = df["spi3"].shift(lag)
    df["spi6_lag1"] = df["spi6"].shift(1)
    for lag in [1,2,3]:
        df[f"precip_lag{lag}"] = df["precip"].shift(lag)

    df["precip_roll3"]  = df["precip"].shift(1).rolling(3).mean()
    df["precip_roll6"]  = df["precip"].shift(1).rolling(6).mean()
    df["precip_roll12"] = df["precip"].shift(1).rolling(12).mean()
    df["precip_std12"]  = df["precip"].shift(1).rolling(12).std()
    df["temp_roll3"]    = df["temp"].shift(1).rolling(3).mean()
    df["et0_roll3"]     = df["et0"].shift(1).rolling(3).mean()

    clim = df.groupby("month")["precip"].transform("mean")
    df["precip_anom"] = (df["precip"].shift(1) - clim.shift(1)) / (clim.shift(1) + 1)

    df["sin1"] = np.sin(2*np.pi*df["month"]/12)
    df["cos1"] = np.cos(2*np.pi*df["month"]/12)
    df["sin2"] = np.sin(4*np.pi*df["month"]/12)
    df["cos2"] = np.cos(4*np.pi*df["month"]/12)

    df["persist"] = df["spi3"].shift(lead)
    df["trend6"]  = df["spi3"].shift(1).rolling(6).apply(
        lambda x: float(np.polyfit(range(len(x)), x, 1)[0]) if len(x)==6 else np.nan, raw=True
    )

    tgt_month = (df["month"] + lead - 1) % 12 + 1
    mcl = df.groupby("month")["spi3"].mean().to_dict()
    df["clim_spi"] = tgt_month.map(mcl)

    # ENSO: ONI decale (signal teleconnexion avec 1 et 3 mois de delai)
    df["oni_lag1"] = df["oni"].shift(1)
    df["oni_lag3"] = df["oni"].shift(3)

    df["target"] = df["spi3"].shift(-lead)
    df = df.dropna(subset=FEAT+["target"]).reset_index(drop=True)
    return df


# ── 6. Walk-forward cross-validation ───────────────────────────────────────
def walkforward_cv(df, n_folds=5, min_train_years=15):
    """
    Time-series walk-forward CV.
    Chaque fold: train sur tout ce qui precede le fold, test sur le fold.
    """
    years = sorted(df["year"].unique())
    # Fold boundaries
    usable = years[min_train_years*12//12:]   # au moins min_train_years d'entrainement
    fold_size = max(1, len(usable) // n_folds)
    folds = []
    for i in range(n_folds):
        start_i = i * fold_size
        end_i   = min(start_i + fold_size, len(usable))
        if end_i <= start_i: continue
        test_years_fold = set(usable[start_i:end_i])
        cutoff_year = min(test_years_fold) - 1
        tr = df[df["year"] <= cutoff_year]
        te = df[df["year"].isin(test_years_fold)]
        if len(tr) < 60 or len(te) < 6: continue
        folds.append((tr, te))
    return folds


# ── 7. Entrainement ensemble ────────────────────────────────────────────────
def train(df, eval_years=2):
    """
    eval_years : annees reservees pour l'evaluation (2024-2026 = 2 ans)
    Le modele FINAL est ensuite reentraine sur toutes les donnees.
    """
    cutoff = df["year"].max() - eval_years
    tr = df[df["year"] <= cutoff].copy()
    te = df[df["year"] >  cutoff].copy()

    if len(te) < 6:
        # Pas assez de donnees test - agrandir la fenetre
        cutoff = df["year"].max() - 3
        tr = df[df["year"] <= cutoff].copy()
        te = df[df["year"] >  cutoff].copy()

    X_tr = tr[FEAT].values; y_tr = tr["target"].values
    X_te = te[FEAT].values; y_te = te["target"].values
    Xtr_df = pd.DataFrame(X_tr, columns=FEAT)
    Xte_df = pd.DataFrame(X_te, columns=FEAT)

    sc = StandardScaler()
    X_tr_s = sc.fit_transform(X_tr)
    X_te_s = sc.transform(X_te)

    base = {
        "Ridge": Ridge(alpha=0.3),
        "RF":    RandomForestRegressor(n_estimators=600, max_depth=6,
                                        min_samples_leaf=6, n_jobs=-1, random_state=42),
        "XGB":   xgb.XGBRegressor(n_estimators=600, max_depth=4, learning_rate=0.015,
                                   subsample=0.85, colsample_bytree=0.8,
                                   reg_alpha=0.1, reg_lambda=1.0,
                                   random_state=42, verbosity=0),
        "LGB":   lgb.LGBMRegressor(n_estimators=600, max_depth=5, learning_rate=0.015,
                                    subsample=0.85, colsample_bytree=0.8,
                                    min_child_samples=15, reg_alpha=0.1,
                                    random_state=42, verbose=-1),
    }

    def cat_spi(v):
        if v >= -1.0: return 0   # Normal
        if v >= -1.5: return 1   # Modere
        if v >= -2.0: return 2   # Severe
        return 3                  # Extreme

    def model_metrics(pred, true):
        cats_t = np.array([cat_spi(v) for v in true])
        cats_p = np.array([cat_spi(v) for v in pred])
        LABELS = [0, 1, 2, 3]
        NAMES  = ["Normal", "Modere", "Severe", "Extreme"]
        # F1 par classe (zero_division=0 si classe absente du test)
        f1_per  = f1_score(cats_t, cats_p, labels=LABELS, average=None, zero_division=0)
        pre_per = precision_score(cats_t, cats_p, labels=LABELS, average=None, zero_division=0)
        rec_per = recall_score(cats_t, cats_p, labels=LABELS, average=None, zero_division=0)
        f1_by_class = {NAMES[i]: round(float(f1_per[i]), 4) for i in range(4)}
        pre_by_class = {NAMES[i]: round(float(pre_per[i]), 4) for i in range(4)}
        rec_by_class = {NAMES[i]: round(float(rec_per[i]), 4) for i in range(4)}
        return {
            "rmse": round(float(np.sqrt(mean_squared_error(true, pred))), 4),
            "mae":  round(float(mean_absolute_error(true, pred)), 4),
            "r2":   round(float(r2_score(true, pred)), 4),
            "accuracy_exact": round(float(np.mean(cats_t == cats_p)) * 100, 1),
            "accuracy_adj":   round(float(np.mean(np.abs(cats_t - cats_p) <= 1)) * 100, 1),
            "f1_weighted":    round(float(f1_score(cats_t, cats_p, average="weighted", zero_division=0)), 4),
            "f1_macro":       round(float(f1_score(cats_t, cats_p, average="macro",    zero_division=0)), 4),
            "f1_per_class":   f1_by_class,
            "precision_per_class": pre_by_class,
            "recall_per_class":    rec_by_class,
        }

    preds_te = {}
    metrics  = {}
    for name, m in base.items():
        Xf = X_tr_s if name=="Ridge" else Xtr_df
        Xe = X_te_s if name=="Ridge" else Xte_df
        m.fit(Xf, y_tr)
        p = m.predict(Xe)
        preds_te[name] = p
        metrics[name] = model_metrics(p, y_te)

    persist_p = te["persist"].values
    clim_p    = te["clim_spi"].values
    metrics["Persist"] = model_metrics(persist_p, y_te)
    metrics["Clim"]    = model_metrics(clim_p,    y_te)

    # Walk-forward CV pour estimer la precision reelle
    folds = walkforward_cv(df, n_folds=5)
    cv_rmses = []
    for tr_f, te_f in folds:
        Xf = pd.DataFrame(tr_f[FEAT].values, columns=FEAT)
        Xe = pd.DataFrame(te_f[FEAT].values, columns=FEAT)
        m_cv = RandomForestRegressor(n_estimators=300, max_depth=6, min_samples_leaf=6,
                                      n_jobs=-1, random_state=42)
        m_cv.fit(Xf, tr_f["target"].values)
        p_cv = m_cv.predict(Xe)
        cv_rmses.append(float(np.sqrt(mean_squared_error(te_f["target"].values, p_cv))))
    cv_rmse = float(np.mean(cv_rmses)) if cv_rmses else None

    # Ensemble: ponderation 1/RMSE^2
    w = {k: 1.0/(metrics[k]["rmse"]**2 + 1e-6) for k in ["Ridge","RF","XGB","LGB"]}
    wt = sum(w.values()); w = {k: v/wt for k,v in w.items()}

    ens_raw = sum(preds_te[k]*w[k] for k in w)
    # Blend final: 65% ML + 20% persist + 15% clim
    ens = 0.65*ens_raw + 0.20*persist_p + 0.15*clim_p

    ens_metrics = model_metrics(ens, y_te)
    ens_metrics["cv_rmse"] = round(cv_rmse, 4) if cv_rmse else None
    ens_metrics["best"]    = True
    metrics["Ensemble"]    = ens_metrics

    sys.stderr.write(f"    {'Model':10s}  {'RMSE':>6}  {'MAE':>6}  {'R2':>6}\n")
    for k,v in metrics.items():
        star = " *" if k=="Ensemble" else ""
        sys.stderr.write(f"    {k:10s}  {v['rmse']:>6.4f}  {v['mae']:>6.4f}  {v['r2']:>+6.4f}{star}\n")
    if cv_rmse:
        sys.stderr.write(f"    CV-RMSE (walk-forward 5-fold): {cv_rmse:.4f}\n")
    ens_acc = metrics["Ensemble"]["accuracy_exact"]
    ens_adj = metrics["Ensemble"]["accuracy_adj"]
    ens_f1w = metrics["Ensemble"]["f1_weighted"]
    ens_f1m = metrics["Ensemble"]["f1_macro"]
    sys.stderr.write(f"    Precision categorielle: exacte={ens_acc}%  +/-1cat={ens_adj}%\n")
    sys.stderr.write(f"    F1 (weighted)={ens_f1w:.4f}  F1 (macro)={ens_f1m:.4f}\n")
    f1pc = metrics["Ensemble"]["f1_per_class"]
    sys.stderr.write(f"    F1 par classe: Normal={f1pc['Normal']:.3f}  Modere={f1pc['Modere']:.3f}  Severe={f1pc['Severe']:.3f}  Extreme={f1pc['Extreme']:.3f}\n")

    rf_fi = sorted(zip(FEAT, base["RF"].feature_importances_), key=lambda x:-x[1])[:12]

    # Reentraine le modele FINAL sur TOUTES les donnees pour les predictions
    X_all = df[FEAT].values
    y_all = df["target"].values
    Xall_df = pd.DataFrame(X_all, columns=FEAT)
    sc_final = StandardScaler()
    X_all_s  = sc_final.fit_transform(X_all)
    for name, m in base.items():
        Xf = X_all_s if name=="Ridge" else Xall_df
        m.fit(Xf, y_all)

    return base, sc_final, metrics, w, te, rf_fi


def predict_steps(df, models, scaler, weights, steps=3):
    row = df[FEAT].iloc[-1:].copy()
    clim_val = float(df["clim_spi"].iloc[-1])
    forecasts = []
    for step in range(1, steps+1):
        X   = row.values
        Xs  = scaler.transform(X)
        Xdf = row.copy()
        preds = {}
        for name, m in models.items():
            Xi = Xs if name=="Ridge" else Xdf
            preds[name] = float(m.predict(Xi)[0])
        ens_raw  = sum(preds[k]*weights[k] for k in weights)
        p_val    = float(row["persist"].values[0])
        fc = round(0.65*ens_raw + 0.20*p_val + 0.15*clim_val, 3)
        forecasts.append(fc)
        row = row.copy()
        row["persist"]   = fc
        row["spi3_lag1"] = fc
    return forecasts


def spi_level(v):
    if v >= -1.0: return "Normal"
    if v >= -1.5: return "Modere"
    if v >= -2.0: return "Severe"
    return "Extreme"


# ── Main ─────────────────────────────────────────────────────────────────────
def main():
    sys.stderr.write(f"Morocco Drought Pipeline - {TODAY_STR}\n")
    sys.stderr.write(f"ERA5-Land: {START_DATE} to {END_DATE}\n\n")

    # Fetch ENSO ONI
    sys.stderr.write("[ENSO] Fetching ONI index (NOAA)...\n")
    oni_df = fetch_enso()

    all_results, all_spi_series, all_metrics, global_fi = [], {}, {}, {}
    all_cv_rmses = []

    for basin in BASINS:
        sys.stderr.write(f"\n[Basin] {basin['name']}\n")
        daily = fetch_basin(basin)
        monthly, partial = to_monthly(daily)
        df = build_features(monthly, oni_df, lead=3)
        sys.stderr.write(f"  Samples: {len(df)}  ({df['year'].min()}-{df['year'].max()})\n")

        base, scaler, metrics, weights, te, rf_fi = train(df)
        forecasts = predict_steps(df, base, scaler, weights, steps=3)

        last = df.iloc[-1]
        spi_now  = round(float(last["spi3"]), 3)
        spi6_now = round(float(last["spi6"]), 3)
        last_date = monthly.iloc[-1]["date"].strftime("%Y-%m")

        # Mois en cours (partiel)
        current_month_partial = None
        if len(partial) > 0:
            pr = float(partial.iloc[0]["precip"]) if not pd.isna(partial.iloc[0]["precip"]) else 0
            nd = int(partial.iloc[0]["n"])
            current_month_partial = {"days": nd, "precip_so_far": round(pr, 1)}

        hist = df.tail(48)[["date","spi3","spi6"]].copy()
        hist["date"] = hist["date"].dt.strftime("%Y-%m")
        series = [{"date": r["date"],
                   "spi3": round(float(r["spi3"]),3),
                   "spi6": round(float(r["spi6"]),3)}
                  for _, r in hist.iterrows()]

        cv_rmse = metrics["Ensemble"].get("cv_rmse")
        if cv_rmse: all_cv_rmses.append(cv_rmse)

        all_results.append({
            "name": basin["name"], "area_km2": basin["area_km2"],
            "lat": basin["lat"], "lon": basin["lon"],
            "last_date": last_date,
            "current_month_partial": current_month_partial,
            "spi_now": spi_now, "spi6_now": spi6_now,
            "spi_t3": forecasts[2], "spi_t1": forecasts[0], "spi_t2": forecasts[1],
            "spi_t6": spi6_now,
            "level_now": spi_level(spi_now), "level_t3": spi_level(forecasts[2]),
            "forecasts": forecasts,
            "accuracy_exact": metrics["Ensemble"]["accuracy_exact"],
            "accuracy_adj":   metrics["Ensemble"]["accuracy_adj"],
        })
        all_spi_series[basin["name"]] = series
        all_metrics[basin["name"]]    = metrics
        for feat, imp in rf_fi:
            global_fi[feat] = global_fi.get(feat, 0.0) + float(imp)

    # National
    spi_all = [b["spi_now"] for b in all_results]
    t3_all  = [b["spi_t3"]  for b in all_results]
    nat_spi = round(float(np.median(spi_all)), 3)
    nat_t3  = round(float(np.median(t3_all)),  3)
    last_date = all_results[0]["last_date"]

    counts = {"Extreme":0,"Severe":0,"Modere":0,"Normal":0}
    for b in all_results:
        counts[b["level_now"]] = counts.get(b["level_now"],0)+1

    # Precision globale
    acc_exact = round(float(np.mean([b["accuracy_exact"] for b in all_results])), 1)
    acc_adj   = round(float(np.mean([b["accuracy_adj"]   for b in all_results])), 1)
    mean_cv   = round(float(np.mean(all_cv_rmses)), 4) if all_cv_rmses else None

    model_names = ["Clim","Persist","Ridge","RF","XGB","LGB","Ensemble"]
    model_summary = []
    for mn in model_names:
        basin_stats = [all_metrics[b["name"]][mn] for b in all_results if mn in all_metrics[b["name"]]]
        if not basin_stats: continue
        # F1 par classe moyen sur tous les bassins
        f1_classes = ["Normal","Modere","Severe","Extreme"]
        f1_avg = {c: round(float(np.mean([s["f1_per_class"][c] for s in basin_stats])), 4) for c in f1_classes}
        pre_avg = {c: round(float(np.mean([s["precision_per_class"][c] for s in basin_stats])), 4) for c in f1_classes}
        rec_avg = {c: round(float(np.mean([s["recall_per_class"][c] for s in basin_stats])), 4) for c in f1_classes}
        entry = {
            "name": mn, "best": mn=="Ensemble",
            "rmse": round(float(np.mean([s["rmse"] for s in basin_stats])), 4),
            "mae":  round(float(np.mean([s["mae"]  for s in basin_stats])), 4),
            "r2":   round(float(np.mean([s["r2"]   for s in basin_stats])), 4),
            "accuracy_exact": round(float(np.mean([s["accuracy_exact"] for s in basin_stats])), 1),
            "accuracy_adj":   round(float(np.mean([s["accuracy_adj"]   for s in basin_stats])), 1),
            "f1_weighted":    round(float(np.mean([s["f1_weighted"] for s in basin_stats])), 4),
            "f1_macro":       round(float(np.mean([s["f1_macro"]    for s in basin_stats])), 4),
            "f1_per_class":   f1_avg,
            "precision_per_class": pre_avg,
            "recall_per_class":    rec_avg,
        }
        if mn == "Ensemble":
            entry["cv_rmse"] = mean_cv
        model_summary.append(entry)

    tot = sum(global_fi.values())
    top_fi = sorted([{"feature":k,"importance":round(v/tot,4)} for k,v in global_fi.items()],
                    key=lambda x:-x["importance"])[:12]

    payload = {
        "generated_at":  pd.Timestamp.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "data_source":   f"ERA5-Land via Open-Meteo ({START_DATE} to {END_DATE})",
        "enso_source":   "NOAA ONI (Oceanic Nino Index)",
        "current_month": last_date,
        "data_end":      END_DATE,
        "national": {
            "spi_now": nat_spi, "spi_t3": nat_t3,
            "level_now": spi_level(nat_spi), "level_t3": spi_level(nat_t3),
            "n_alert": counts["Extreme"]+counts["Severe"],
            "n_extreme": counts["Extreme"], "n_severe": counts["Severe"],
            "n_modere": counts["Modere"],   "n_normal": counts["Normal"],
        },
        "model_performance": {
            "accuracy_category_exact": acc_exact,
            "accuracy_category_adj":   acc_adj,
            "cv_rmse_walkforward":     mean_cv,
            "note": "Test period 2025-2026, horizon T+3 mois"
        },
        "basins": all_results,
        "spi_series": all_spi_series,
        "feature_importance": top_fi,
        "model_metrics": model_summary,
    }

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    sys.stderr.write(f"\nSaved -> {OUT_JSON}\n")
    sys.stderr.write(f"Data end      : {END_DATE}\n")
    sys.stderr.write(f"Current month : {last_date}\n")
    sys.stderr.write(f"National SPI  : {nat_spi:+.3f}  ({spi_level(nat_spi)})\n")
    sys.stderr.write(f"Forecast T+3  : {nat_t3:+.3f}  ({spi_level(nat_t3)})\n")
    sys.stderr.write(f"In alert      : {counts['Extreme']+counts['Severe']}/{len(BASINS)}\n")
    sys.stderr.write(f"\nPrecision categorielle:\n")
    sys.stderr.write(f"  Exacte     : {acc_exact}%\n")
    sys.stderr.write(f"  +/-1 cat   : {acc_adj}%\n")
    if mean_cv:
        sys.stderr.write(f"  CV-RMSE    : {mean_cv}\n")
    sys.stderr.write(f"\nPer-basin:\n")
    for b in sorted(all_results, key=lambda x: x["spi_now"]):
        sys.stderr.write(f"  {b['name']:20s}  SPI={b['spi_now']:+.3f}  {b['level_now']:8s}  T+3={b['spi_t3']:+.3f}\n")


if __name__ == "__main__":
    main()
