#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
╔══════════════════════════════════════════════════════════════════════╗
║   PRÉTRAITEMENT ML — Prédiction Sécheresse Maroc                   ║
║   VERSION CORRIGÉE v2                                               ║
║                                                                      ║
║   Corrections critiques apportées :                                  ║
║   1. FORECAST HORIZON : target décalée de H mois dans le futur      ║
║      → X[t] prédit drought_label[t+3], [t+6], [t+12]               ║
║   2. Suppression du data leakage SPI/features                       ║
║   3. One-Hot encoding fait UNE SEULE FOIS sur monthly complet        ║
║      puis split → colonnes identiques garanties                      ║
║   4. Normalisation : fit sur train uniquement, transform sur test    ║
║   5. Lags calculés sur features brutes UNIQUEMENT (pas SPI)         ║
║   6. 3 fichiers de sortie : train/val/test (split temporel strict)  ║
╚══════════════════════════════════════════════════════════════════════╝
"""

import pandas as pd
import numpy as np
from scipy import stats
from scipy.special import ndtri
from sklearn.preprocessing import StandardScaler
import warnings
import os
import glob
import joblib

warnings.filterwarnings("ignore")

# ================================================================
# PARAMÈTRES GLOBAUX
# ================================================================

DATA_DIR       = r"C:\Users\asus\Desktop\data brute"
REFERENCE_END  = "2020-12-31"   # Période de référence WMO pour le SPI
SPLIT_TRAIN    = "2019-01-01"   # Fin du train
SPLIT_VAL      = "2021-01-01"   # Fin de la validation  → Test = tout ce qui suit
HORIZONS       = [3, 6, 12]     # Horizons de prédiction en mois

# Classification 3 classes (WMO)
# Sec    : SPI_6 < -1.0
# Normal : -1.0 ≤ SPI_6 < 1.0
# Humide : SPI_6 ≥ 1.0
DRY_THRESHOLD  = -1.0
WET_THRESHOLD  =  1.0

LABEL_MAP = {0: "Sec", 1: "Normal", 2: "Humide"}


# ================================================================
# ÉTAPE 0 — Chargement des fichiers CSV bruts
# ================================================================
print("=" * 70)
print("ÉTAPE 0 — Chargement des fichiers CSV bruts")
print("=" * 70)

csv_files = sorted(glob.glob(os.path.join(DATA_DIR, "*_raw_data.csv")))
print(f"  → {len(csv_files)} fichiers trouvés")

if len(csv_files) == 0:
    raise FileNotFoundError(
        f"Aucun fichier *_raw_data.csv trouvé dans : {DATA_DIR}\n"
        "Vérifiez le chemin DATA_DIR en haut du script."
    )

all_dfs = {}

for csv_path in csv_files:
    city_name = os.path.basename(csv_path).replace("_raw_data.csv", "")
    print(f"  → Chargement : {city_name}...", end=" ")

    df_raw = pd.read_csv(csv_path, skiprows=3)
    cols   = df_raw.columns.tolist()

    col_mapping = {}
    for col in cols:
        col_lower = col.lower()
        if "time" in col_lower:
            col_mapping[col] = "date"
        elif "temperature" in col_lower and "2m" in col_lower:
            col_mapping[col] = "temp_mean"
        elif "precipitation" in col_lower:
            col_mapping[col] = "precip_sum"
        elif "et0" in col_lower or "evapotrans" in col_lower:
            col_mapping[col] = "et0"
        elif "soil_moisture_0_to_7" in col_lower:
            col_mapping[col] = "soil_0_7cm"
        elif "soil_moisture_0_to_100" in col_lower:
            col_mapping[col] = "soil_0_100cm"

    df_raw = df_raw.rename(columns=col_mapping)

    required = ["date", "temp_mean", "precip_sum", "et0",
                "soil_0_7cm", "soil_0_100cm"]
    missing  = [c for c in required if c not in df_raw.columns]
    if missing:
        print(f"\n    ⚠️  Colonnes manquantes pour {city_name}: {missing}")
        print(f"       Colonnes disponibles : {df_raw.columns.tolist()}")

    df_raw = df_raw[[c for c in required if c in df_raw.columns]]
    df_raw["date"] = pd.to_datetime(df_raw["date"])
    df_raw = df_raw.set_index("date")
    df_raw["ville"] = city_name

    all_dfs[city_name] = df_raw
    print(f"{len(df_raw)} observations")

df_daily = pd.concat(all_dfs.values(), axis=0).sort_index()
print(f"\n  → Total journalier : {len(df_daily)} observations")
print(f"  → Villes : {sorted(all_dfs.keys())}\n")


# ================================================================
# ÉTAPE 1 — Correction des valeurs aberrantes
# ================================================================
print("=" * 70)
print("ÉTAPE 1 — Correction valeurs aberrantes")
print("=" * 70)

n_soil_bad = ((df_daily["soil_0_7cm"] < 0) | (df_daily["soil_0_7cm"] > 1)).sum()
df_daily["soil_0_7cm"]   = df_daily["soil_0_7cm"].clip(0.0, 1.0)
df_daily["soil_0_100cm"] = df_daily["soil_0_100cm"].clip(0.0, 1.0)
df_daily["precip_sum"]   = df_daily["precip_sum"].clip(lower=0.0)
df_daily["et0"]          = df_daily["et0"].clip(lower=0.0)

print(f"  → soil_0_7cm  valeurs aberrantes corrigées : {n_soil_bad}")
print(f"  → précipitations et ET0 négatifs remis à 0\n")


# ================================================================
# ÉTAPE 2 — Agrégation journalière → mensuelle (par ville)
# ================================================================
print("=" * 70)
print("ÉTAPE 2 — Agrégation journalière → mensuelle")
print("=" * 70)

monthly_list = []

for ville in sorted(df_daily["ville"].unique()):
    df_v = df_daily[df_daily["ville"] == ville].copy()

    m = df_v.resample("MS").agg({
        "precip_sum":   "sum",    # précipitations = cumul
        "temp_mean":    "mean",   # température    = moyenne
        "et0":          "sum",    # ET0 = cumul journalier → sum
        "soil_0_7cm":   "mean",
        "soil_0_100cm": "mean",
        "ville":        "first",
    })

    # Ratio P/ET0 — bilan hydrique direct
    m["ratio_p_et0"] = (m["precip_sum"] / m["et0"].clip(lower=0.1)).clip(upper=10.0)

    monthly_list.append(m)
    print(f"  → {ville:20} : {len(m)} mois")

monthly = pd.concat(monthly_list, axis=0).sort_index()
print(f"\n  → Total mensuel : {len(monthly)} observations")
print(f"  → ratio_p_et0 ajouté (précip / ET0)\n")


# ================================================================
# ÉTAPE 3 — Calcul SPI (par ville, méthode WMO)
# ================================================================
print("=" * 70)
print("ÉTAPE 3 — Calcul SPI par ville (méthode WMO)")
print("=" * 70)

def compute_spi(precip_series: pd.Series, scale: int,
                ref_end: str) -> pd.Series:
    """
    Calcul SPI standard WMO :
    - rolling sum sur `scale` mois
    - ajustement Gamma PAR MOIS sur la période de référence uniquement
    - transformation en Z-score via ndtri
    """
    rolling    = precip_series.rolling(scale).sum()
    spi_values = np.full(len(rolling), np.nan)

    for month in range(1, 13):
        idx_all  = rolling.index.month == month
        ref_mask = idx_all & (rolling.index <= ref_end)
        ref_data = rolling[ref_mask].dropna().values

        if len(ref_data) < 10:
            continue

        q       = (ref_data == 0).mean()
        nonzero = ref_data[ref_data > 0]
        if len(nonzero) < 5:
            continue

        shape, _, scale_param = stats.gamma.fit(nonzero, floc=0)
        idx_positions = np.where(idx_all)[0]

        for pos in idx_positions:
            val = rolling.iloc[pos]
            if np.isnan(val):
                continue
            if val == 0:
                prob = q / 2.0
            else:
                prob = q + (1 - q) * stats.gamma.cdf(
                    val, shape, loc=0, scale=scale_param
                )
            prob = np.clip(prob, 1e-6, 1 - 1e-6)
            spi_values[pos] = ndtri(prob)

    return pd.Series(spi_values, index=rolling.index)


for ville in sorted(monthly["ville"].unique()):
    mask   = monthly["ville"] == ville
    precip = monthly.loc[mask, "precip_sum"]

    monthly.loc[mask, "SPI_3"]  = compute_spi(precip, 3,  REFERENCE_END).values
    monthly.loc[mask, "SPI_6"]  = compute_spi(precip, 6,  REFERENCE_END).values
    monthly.loc[mask, "SPI_12"] = compute_spi(precip, 12, REFERENCE_END).values

print(f"  → SPI_3, SPI_6, SPI_12 calculés pour toutes les villes\n")


# ================================================================
# ÉTAPE 4 — Création des TARGETS décalées dans le futur
#           ⚠️  CORRECTION CRITIQUE : FORECAST HORIZON
# ================================================================
print("=" * 70)
print("ÉTAPE 4 — Création des TARGETS futures (horizon H mois)")
print("=" * 70)
print("""
  PRINCIPE :
  Le modèle reçoit les données du mois T (précip, temp, ET0, sol,
  lags, moyennes mobiles...) et doit PRÉDIRE la catégorie de
  sécheresse au mois T+H (H = 3, 6 ou 12 mois).

  Sans ce décalage, le modèle apprend X[t] → y[t]
  (il prédit le présent, pas le futur → inutile en pratique).
""")


def spi_to_3class(spi_val):
    """Convertit SPI en 3 classes : 0=Sec, 1=Normal, 2=Humide"""
    if pd.isna(spi_val):
        return np.nan
    elif spi_val < DRY_THRESHOLD:
        return 0   # Sec
    elif spi_val < WET_THRESHOLD:
        return 1   # Normal
    else:
        return 2   # Humide


for ville in sorted(monthly["ville"].unique()):
    mask = monthly["ville"] == ville

    for H in HORIZONS:
        # SPI_6 est le meilleur indicateur de sécheresse à moyen terme
        # On le décale de -H (shift vers le haut = regarder H mois dans le futur)
        future_spi6 = monthly.loc[mask, "SPI_6"].shift(-H)
        monthly.loc[mask, f"target_H{H}"] = future_spi6.apply(spi_to_3class)

# Vérification
print(f"  Targets créées : {[f'target_H{H}' for H in HORIZONS]}")
print(f"  Encodage : 0=Sec | 1=Normal | 2=Humide (basé sur SPI_6 futur)\n")

for H in HORIZONS:
    dist = monthly[f"target_H{H}"].value_counts().sort_index()
    total = dist.sum()
    print(f"  Distribution target_H{H} :")
    for label, count in dist.items():
        pct = count / total * 100
        bar = "█" * int(pct / 2)
        name = LABEL_MAP.get(int(label), "?")
        print(f"    {name:7} ({int(label)}) : {count:4} ({pct:5.1f}%)  {bar}")
    print()


# ================================================================
# ÉTAPE 5 — Encodage saisonnier
# ================================================================
print("=" * 70)
print("ÉTAPE 5 — Encodage saisonnier (sin/cos du mois)")
print("=" * 70)

monthly["month_sin"] = np.sin(2 * np.pi * monthly.index.month / 12)
monthly["month_cos"] = np.cos(2 * np.pi * monthly.index.month / 12)
print(f"  → month_sin, month_cos ajoutés\n")


# ================================================================
# ÉTAPE 6 — Feature engineering : lags PAR VILLE
#           (UNIQUEMENT sur features brutes — pas sur SPI)
# ================================================================
print("=" * 70)
print("ÉTAPE 6 — Lags par ville (features brutes uniquement)")
print("=" * 70)

# ⚠️ On ne lague PAS les SPI (ce sont des targets ou des proxys de targets)
LAG_FEATURES = ["precip_sum", "temp_mean", "et0", "soil_0_7cm",
                "soil_0_100cm", "ratio_p_et0"]
LAG_PERIODS  = [1, 2, 3, 6, 12]

for ville in sorted(monthly["ville"].unique()):
    mask = monthly["ville"] == ville
    for feat in LAG_FEATURES:
        for lag in LAG_PERIODS:
            monthly.loc[mask, f"{feat}_lag{lag}"] = (
                monthly.loc[mask, feat].shift(lag)
            )

n_lags = len(LAG_FEATURES) * len(LAG_PERIODS)
print(f"  → {n_lags} features de lag ajoutées (par ville)\n")


# ================================================================
# ÉTAPE 7 — Feature engineering : moyennes mobiles PAR VILLE
# ================================================================
print("=" * 70)
print("ÉTAPE 7 — Moyennes mobiles par ville")
print("=" * 70)

ROLLING_FEATURES = ["precip_sum", "temp_mean", "et0", "ratio_p_et0"]
ROLLING_WINDOWS  = [3, 6, 12]

for ville in sorted(monthly["ville"].unique()):
    mask = monthly["ville"] == ville
    for feat in ROLLING_FEATURES:
        for w in ROLLING_WINDOWS:
            monthly.loc[mask, f"{feat}_roll{w}"] = (
                monthly.loc[mask, feat].rolling(w, min_periods=w).mean()
            )

n_rolls = len(ROLLING_FEATURES) * len(ROLLING_WINDOWS)
print(f"  → {n_rolls} rolling means ajoutées (par ville)\n")


# ================================================================
# ÉTAPE 8 — One-Hot encoding des villes (UNE SEULE FOIS)
#           ⚠️  CORRECTION : encodage AVANT le split pour garantir
#           des colonnes identiques entre train/val/test
# ================================================================
print("=" * 70)
print("ÉTAPE 8 — One-Hot encoding des villes (avant le split)")
print("=" * 70)

ville_dummies = pd.get_dummies(monthly["ville"], prefix="ville", drop_first=False)
monthly = pd.concat([monthly.drop("ville", axis=1), ville_dummies], axis=1)

ville_cols = ville_dummies.columns.tolist()
print(f"  → Villes encodées : {[c.replace('ville_','') for c in ville_cols]}\n")


# ================================================================
# ÉTAPE 9 — Définition des colonnes features / targets
# ================================================================
print("=" * 70)
print("ÉTAPE 9 — Définition features / targets")
print("=" * 70)

TARGET_COLS  = [f"target_H{H}" for H in HORIZONS]
SPI_COLS     = ["SPI_3", "SPI_6", "SPI_12"]
EXCLUDE_COLS = set(TARGET_COLS + SPI_COLS)

# Les features cycliques ne sont PAS normalisées (déjà dans [-1, 1])
CYCLIC_COLS  = ["month_sin", "month_cos"]

FEATURE_COLS_RAW = [
    c for c in monthly.columns
    if c not in EXCLUDE_COLS
    and c not in CYCLIC_COLS
]

print(f"  → {len(FEATURE_COLS_RAW)} features numériques (à normaliser)")
print(f"  → {len(CYCLIC_COLS)} features cycliques (non normalisées)")
print(f"  → {len(TARGET_COLS)} colonnes cibles : {TARGET_COLS}\n")


# ================================================================
# ÉTAPE 10 — Split temporel strict : Train / Val / Test
# ================================================================
print("=" * 70)
print("ÉTAPE 10 — Split temporel (Train / Val / Test)")
print("=" * 70)
print(f"""
  Découpe :
    Train : début → {SPLIT_TRAIN}
    Val   : {SPLIT_TRAIN} → {SPLIT_VAL}
    Test  : {SPLIT_VAL} → fin

  ⚠️  NaN supprimés APRÈS le split (important pour les lags du début)
""")

train_raw = monthly[monthly.index <  SPLIT_TRAIN].copy()
val_raw   = monthly[(monthly.index >= SPLIT_TRAIN) & (monthly.index < SPLIT_VAL)].copy()
test_raw  = monthly[monthly.index >= SPLIT_VAL].copy()

print(f"  Avant dropna :")
print(f"    Train : {len(train_raw)} obs")
print(f"    Val   : {len(val_raw)}  obs")
print(f"    Test  : {len(test_raw)}  obs")

# On supprime les NaN dans chaque split séparément
# Les dernières lignes auront NaN dans les targets (décalage futur)
# → on les supprime aussi
train_raw = train_raw.dropna(subset=FEATURE_COLS_RAW + TARGET_COLS)
val_raw   = val_raw.dropna(subset=FEATURE_COLS_RAW + TARGET_COLS)
test_raw  = test_raw.dropna(subset=FEATURE_COLS_RAW + TARGET_COLS)

print(f"\n  Après dropna :")
print(f"    Train : {len(train_raw)} obs")
print(f"    Val   : {len(val_raw)}  obs")
print(f"    Test  : {len(test_raw)}  obs")

total = len(train_raw) + len(val_raw) + len(test_raw)
print(f"\n  Ratio : {len(train_raw)/total*100:.1f}% train / "
      f"{len(val_raw)/total*100:.1f}% val / "
      f"{len(test_raw)/total*100:.1f}% test\n")


# ================================================================
# ÉTAPE 11 — Normalisation (fit UNIQUEMENT sur train)
# ================================================================
print("=" * 70)
print("ÉTAPE 11 — Normalisation StandardScaler (fit sur train uniquement)")
print("=" * 70)

scaler = StandardScaler()

# Imputation médiane (train uniquement) avant normalisation
medians = train_raw[FEATURE_COLS_RAW].median()

def impute_and_scale(df_split, medians_ref, scaler_ref, fit=False):
    features = df_split[FEATURE_COLS_RAW].copy()
    features = features.fillna(medians_ref)

    if fit:
        scaled = scaler_ref.fit_transform(features)
    else:
        scaled = scaler_ref.transform(features)

    df_scaled = pd.DataFrame(scaled, index=df_split.index,
                             columns=FEATURE_COLS_RAW)

    # Rajouter features cycliques (non normalisées)
    for col in CYCLIC_COLS:
        df_scaled[col] = df_split[col].values

    # Rajouter les targets
    for col in TARGET_COLS + SPI_COLS:
        if col in df_split.columns:
            df_scaled[col] = df_split[col].values

    # Rajouter colonnes One-Hot villes
    for col in ville_cols:
        df_scaled[col] = df_split[col].values

    return df_scaled


train_final = impute_and_scale(train_raw, medians, scaler, fit=True)
val_final   = impute_and_scale(val_raw,   medians, scaler, fit=False)
test_final  = impute_and_scale(test_raw,  medians, scaler, fit=False)

print(f"  → Normalisation appliquée")
print(f"  → NaN résiduels train : {train_final.isnull().sum().sum()}")
print(f"  → NaN résiduels val   : {val_final.isnull().sum().sum()}")
print(f"  → NaN résiduels test  : {test_final.isnull().sum().sum()}\n")


# ================================================================
# ÉTAPE 12 — Export des fichiers + scaler + feature list
# ================================================================
print("=" * 70)
print("ÉTAPE 12 — Export des fichiers")
print("=" * 70)

TRAIN_FILE   = os.path.join(DATA_DIR, "train_data.csv")
VAL_FILE     = os.path.join(DATA_DIR, "val_data.csv")
TEST_FILE    = os.path.join(DATA_DIR, "test_data.csv")
SCALER_FILE  = os.path.join(DATA_DIR, "scaler.pkl")
FCOLS_FILE   = os.path.join(DATA_DIR, "feature_cols.pkl")
META_FILE    = os.path.join(DATA_DIR, "preprocessing_meta.pkl")

train_final.to_csv(TRAIN_FILE, index=True)
val_final.to_csv(VAL_FILE,   index=True)
test_final.to_csv(TEST_FILE,  index=True)

# Sauvegarder le scaler et la liste des features pour l'inférence
ALL_FEATURE_COLS = FEATURE_COLS_RAW + CYCLIC_COLS + ville_cols
joblib.dump(scaler,           SCALER_FILE)
joblib.dump(ALL_FEATURE_COLS, FCOLS_FILE)

meta = {
    "feature_cols_raw":    FEATURE_COLS_RAW,
    "cyclic_cols":         CYCLIC_COLS,
    "ville_cols":          ville_cols,
    "all_feature_cols":    ALL_FEATURE_COLS,
    "target_cols":         TARGET_COLS,
    "horizons":            HORIZONS,
    "label_map":           LABEL_MAP,
    "dry_threshold":       DRY_THRESHOLD,
    "wet_threshold":       WET_THRESHOLD,
    "split_train":         SPLIT_TRAIN,
    "split_val":           SPLIT_VAL,
    "medians":             medians.to_dict(),
}
joblib.dump(meta, META_FILE)

print(f"  ✅ Train  : {TRAIN_FILE}   ({len(train_final)} obs × {len(train_final.columns)} col)")
print(f"  ✅ Val    : {VAL_FILE}     ({len(val_final)} obs × {len(val_final.columns)} col)")
print(f"  ✅ Test   : {TEST_FILE}    ({len(test_final)} obs × {len(test_final.columns)} col)")
print(f"  ✅ Scaler : {SCALER_FILE}")
print(f"  ✅ Meta   : {META_FILE}\n")


# ================================================================
# ÉTAPE 13 — VÉRIFICATIONS FINALES
# ================================================================
print("=" * 70)
print("ÉTAPE 13 — VÉRIFICATIONS FINALES")
print("=" * 70)

print(f"\n📅 SPLIT TEMPOREL (aucun chevauchement) :")
print(f"  Train  : {train_final.index.min().date()} → {train_final.index.max().date()}")
print(f"  Val    : {val_final.index.min().date()} → {val_final.index.max().date()}")
print(f"  Test   : {test_final.index.min().date()} → {test_final.index.max().date()}")
assert train_final.index.max() < val_final.index.min(),   "ERREUR : chevauchement train/val !"
assert val_final.index.max()   < test_final.index.min(),  "ERREUR : chevauchement val/test !"
print(f"  → Aucun chevauchement ✅")

print(f"\n🎯 DISTRIBUTION DES CLASSES PAR HORIZON (Train) :")
for H in HORIZONS:
    col  = f"target_H{H}"
    dist = train_final[col].value_counts().sort_index()
    total = dist.sum()
    print(f"\n  Horizon +{H} mois :")
    for label, count in dist.items():
        pct  = count / total * 100
        name = LABEL_MAP.get(int(label), "?")
        bar  = "█" * int(pct / 2)
        print(f"    {name:7} : {count:4} ({pct:5.1f}%)  {bar}")
    # Avertissement déséquilibre
    max_pct = dist.max() / total * 100
    if max_pct > 60:
        dom_label = LABEL_MAP[int(dist.idxmax())]
        print(f"    ⚠️  Déséquilibre : {dom_label} domine à {max_pct:.1f}% → utiliser SMOTE")

print(f"\n🏙️ OBSERVATIONS PAR VILLE (Train) :")
for col in sorted([c for c in train_final.columns if c.startswith("ville_")]):
    name = col.replace("ville_", "")
    n_tr = int(train_final[col].sum())
    n_va = int(val_final[col].sum())
    n_te = int(test_final[col].sum())
    print(f"  {name:20} : Train={n_tr:3}  Val={n_va:3}  Test={n_te:3}")

print(f"\n📐 DIMENSIONS FINALES :")
print(f"  Train  : {train_final.shape}")
print(f"  Val    : {val_final.shape}")
print(f"  Test   : {test_final.shape}")

print("\n" + "=" * 70)
print("✅ PRÉTRAITEMENT TERMINÉ — Prêt pour la modélisation")
print("=" * 70)
print(f"""
📁 FICHIERS GÉNÉRÉS :
  train_data.csv  ({len(train_final)} obs)
  val_data.csv    ({len(val_final)} obs)
  test_data.csv   ({len(test_final)} obs)
  scaler.pkl      → à utiliser pour normaliser de nouvelles données
  feature_cols.pkl → liste ordonnée des features
  preprocessing_meta.pkl → tous les paramètres du prétraitement

🎯 TARGETS DISPONIBLES (3 classes : 0=Sec | 1=Normal | 2=Humide) :
  target_H3   → sécheresse dans 3 mois
  target_H6   → sécheresse dans 6 mois
  target_H12  → sécheresse dans 12 mois

🚀 PRÊT POUR modeling_v2.py !
""")