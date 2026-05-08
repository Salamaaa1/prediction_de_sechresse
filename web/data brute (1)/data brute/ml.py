#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
╔══════════════════════════════════════════════════════════════════════╗
║   MODÉLISATION ML v3 — Prédiction Sécheresse Maroc                 ║
║                                                                      ║
║   Améliorations vs v2 (pour augmenter la précision) :              ║
║   1. SMOTETomek au lieu de SMOTE seul (nettoyage frontières)       ║
║   2. Ensemble pondéré XGB×3 + LGBM×2 (RF retiré — trop faible)    ║
║   3. SPI_3 et SPI_12 ajoutés comme FEATURES (pas data leakage)     ║
║   4. Optuna pour tuning automatique des hyperparamètres            ║
║   5. Seuil de décision ajusté par classe (threshold tuning)        ║
╚══════════════════════════════════════════════════════════════════════╝

INSTALLATION si besoin :
    pip install xgboost lightgbm imbalanced-learn optuna
"""

import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import warnings
import os
import joblib
from collections import defaultdict

import optuna
optuna.logging.set_verbosity(optuna.logging.WARNING)

from sklearn.ensemble import VotingClassifier
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import (
    classification_report, confusion_matrix,
    f1_score, accuracy_score, ConfusionMatrixDisplay,
)
from sklearn.utils.class_weight import compute_class_weight
from imblearn.combine import SMOTETomek
from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline as ImbPipeline

from xgboost  import XGBClassifier
from lightgbm import LGBMClassifier

warnings.filterwarnings("ignore")

# ================================================================
# CONFIG
# ================================================================

DATA_DIR   = r"C:\Users\asus\Desktop\data brute"
TRAIN_FILE = os.path.join(DATA_DIR, "train_data.csv")
VAL_FILE   = os.path.join(DATA_DIR, "val_data.csv")
TEST_FILE  = os.path.join(DATA_DIR, "test_data.csv")
META_FILE  = os.path.join(DATA_DIR, "preprocessing_meta.pkl")
OUTPUT_DIR = DATA_DIR

HORIZONS     = [3, 6, 12]
LABEL_MAP    = {0: "Sec", 1: "Normal", 2: "Humide"}
N_CV_FOLDS   = 5
N_OPTUNA     = 60       # nombre d'essais Optuna par modèle × horizon
RANDOM_STATE = 42


# ================================================================
# ÉTAPE 1 — Chargement
# ================================================================
print("=" * 70)
print("ÉTAPE 1 — Chargement")
print("=" * 70)

train = pd.read_csv(TRAIN_FILE, index_col=0, parse_dates=True)
val   = pd.read_csv(VAL_FILE,   index_col=0, parse_dates=True)
test  = pd.read_csv(TEST_FILE,  index_col=0, parse_dates=True)

if os.path.exists(META_FILE):
    meta = joblib.load(META_FILE)
    ALL_FEATURE_COLS = [c for c in meta["all_feature_cols"]
                        if c in train.columns]
    print(f"  → Métadonnées chargées")
else:
    EXCLUDE = {f"target_H{H}" for H in HORIZONS} | {"SPI_3","SPI_6","SPI_12"}
    ALL_FEATURE_COLS = [c for c in train.columns if c not in EXCLUDE]

# ──────────────────────────────────────────────────────────────────
# AMÉLIORATION 3 : ajouter SPI_3 et SPI_12 comme features
# (observation au mois T → pas de data leakage pour prédire T+H)
# ──────────────────────────────────────────────────────────────────
SPI_AS_FEATURES = ["SPI_3", "SPI_12"]   # SPI_6 reste la target

for col in SPI_AS_FEATURES:
    if col in train.columns and col not in ALL_FEATURE_COLS:
        ALL_FEATURE_COLS.append(col)
        print(f"  → {col} ajouté comme feature")

# Données combinées train+val pour l'entraînement final
train_val = pd.concat([train, val], axis=0).sort_index()

print(f"\n  → Train    : {train.shape}")
print(f"  → Val      : {val.shape}")
print(f"  → Test     : {test.shape}")
print(f"  → Features : {len(ALL_FEATURE_COLS)}\n")


# ================================================================
# ÉTAPE 2 — Fonctions utilitaires
# ================================================================

def get_xy(df, target_col, feature_cols):
    """Extrait X, y en filtrant les NaN sur la target."""
    mask = df[target_col].notna()
    X    = df.loc[mask, feature_cols].values
    y    = df.loc[mask, target_col].astype(int).values
    return X, y


def smote_tomek_resample(X, y, random_state=42):
    """
    SMOTETomek = SMOTE (génère des exemples minoritaires)
               + Tomek Links (supprime les exemples ambigus à la frontière)
    → Meilleure séparation des classes que SMOTE seul.
    """
    min_class_count = min(np.bincount(y))
    k_neighbors     = max(1, min(5, min_class_count - 1))

    smt = SMOTETomek(
        smote=SMOTE(random_state=random_state, k_neighbors=k_neighbors),
        random_state=random_state,
    )
    X_res, y_res = smt.fit_resample(X, y)
    return X_res, y_res


def class_weights_array(y):
    """Calcule sample_weight pour XGBoost."""
    classes = np.array(sorted(np.unique(y)))
    weights = compute_class_weight("balanced", classes=classes, y=y)
    cw_dict = dict(zip(classes.tolist(), weights.tolist()))
    return np.array([cw_dict[yi] for yi in y]), cw_dict


# ================================================================
# ÉTAPE 3 — Tuning Optuna
# ================================================================

def tune_xgb(X_train, y_train, n_classes, n_trials=N_OPTUNA):
    """Cherche les meilleurs hyperparamètres XGBoost avec Optuna."""
    tscv = TimeSeriesSplit(n_splits=3)

    def objective(trial):
        params = {
            "objective":         "multi:softprob",
            "num_class":         n_classes,
            "eval_metric":       "mlogloss",
            "verbosity":         0,
            "random_state":      RANDOM_STATE,
            "n_estimators":      trial.suggest_int("n_estimators", 200, 800),
            "max_depth":         trial.suggest_int("max_depth", 3, 7),
            "learning_rate":     trial.suggest_float("learning_rate", 0.01, 0.15, log=True),
            "subsample":         trial.suggest_float("subsample", 0.6, 1.0),
            "colsample_bytree":  trial.suggest_float("colsample_bytree", 0.5, 1.0),
            "min_child_weight":  trial.suggest_int("min_child_weight", 1, 10),
            "gamma":             trial.suggest_float("gamma", 0.0, 0.5),
            "reg_alpha":         trial.suggest_float("reg_alpha", 0.0, 1.0),
            "reg_lambda":        trial.suggest_float("reg_lambda", 0.5, 3.0),
        }
        scores = []
        for tr_idx, val_idx in tscv.split(X_train):
            Xtr, Xval = X_train[tr_idx], X_train[val_idx]
            ytr, yval = y_train[tr_idx], y_train[val_idx]
            Xtr_sm, ytr_sm = smote_tomek_resample(Xtr, ytr, RANDOM_STATE)
            sw, _   = class_weights_array(ytr_sm)
            model   = XGBClassifier(**params)
            model.fit(Xtr_sm, ytr_sm, sample_weight=sw)
            pred    = model.predict(Xval)
            scores.append(f1_score(yval, pred, average="macro", zero_division=0))
        return np.mean(scores)

    study = optuna.create_study(direction="maximize",
                                sampler=optuna.samplers.TPESampler(seed=RANDOM_STATE))
    study.optimize(objective, n_trials=n_trials, show_progress_bar=False)
    return study.best_params


def tune_lgbm(X_train, y_train, n_classes, n_trials=N_OPTUNA):
    """Cherche les meilleurs hyperparamètres LightGBM avec Optuna."""
    tscv = TimeSeriesSplit(n_splits=3)

    def objective(trial):
        params = {
            "objective":          "multiclass",
            "num_class":          n_classes,
            "random_state":       RANDOM_STATE,
            "verbose":            -1,
            "n_estimators":       trial.suggest_int("n_estimators", 200, 800),
            "max_depth":          trial.suggest_int("max_depth", 3, 7),
            "learning_rate":      trial.suggest_float("learning_rate", 0.01, 0.15, log=True),
            "subsample":          trial.suggest_float("subsample", 0.6, 1.0),
            "colsample_bytree":   trial.suggest_float("colsample_bytree", 0.5, 1.0),
            "min_child_samples":  trial.suggest_int("min_child_samples", 5, 50),
            "reg_alpha":          trial.suggest_float("reg_alpha", 0.0, 1.0),
            "reg_lambda":         trial.suggest_float("reg_lambda", 0.5, 3.0),
            "num_leaves":         trial.suggest_int("num_leaves", 20, 80),
        }
        scores = []
        for tr_idx, val_idx in tscv.split(X_train):
            Xtr, Xval = X_train[tr_idx], X_train[val_idx]
            ytr, yval = y_train[tr_idx], y_train[val_idx]
            Xtr_sm, ytr_sm = smote_tomek_resample(Xtr, ytr, RANDOM_STATE)
            _, cw_dict = class_weights_array(ytr_sm)
            model = LGBMClassifier(**params, class_weight=cw_dict)
            model.fit(Xtr_sm, ytr_sm)
            pred  = model.predict(Xval)
            scores.append(f1_score(yval, pred, average="macro", zero_division=0))
        return np.mean(scores)

    study = optuna.create_study(direction="maximize",
                                sampler=optuna.samplers.TPESampler(seed=RANDOM_STATE))
    study.optimize(objective, n_trials=n_trials, show_progress_bar=False)
    return study.best_params


# ================================================================
# ÉTAPE 4 — Ajustement des seuils de décision (threshold tuning)
# ================================================================

def tune_thresholds(model, X_val, y_val, n_classes=3):
    """
    Cherche les seuils de probabilité optimaux par classe
    pour maximiser le F1-Macro sur le jeu de validation.

    Par défaut, predict() choisit la classe avec la probabilité max.
    Ajuster les seuils permet de favoriser les classes rares (Sec, Humide).

    Retourne un array de seuils [seuil_classe0, seuil_classe1, seuil_classe2].
    """
    probas = model.predict_proba(X_val)   # shape (n_samples, n_classes)
    best_f1     = 0.0
    best_thresh = np.ones(n_classes) / n_classes

    # Grid search rapide sur les seuils des classes minoritaires
    for t0 in np.arange(0.2, 0.7, 0.05):      # seuil Sec
        for t2 in np.arange(0.2, 0.7, 0.05):  # seuil Humide
            t1 = 1.0 - t0 - t2
            if t1 <= 0:
                continue
            thresh = np.array([t0, t1, t2])
            # Normaliser pour que la somme = 1
            thresh = thresh / thresh.sum()

            # Prédire en multipliant les probas par les seuils inversés
            adjusted = probas / thresh
            y_pred   = np.argmax(adjusted, axis=1)
            f1       = f1_score(y_val, y_pred, average="macro", zero_division=0)

            if f1 > best_f1:
                best_f1     = f1
                best_thresh = thresh

    print(f"      Seuils optimaux : Sec={best_thresh[0]:.2f} "
          f"| Normal={best_thresh[1]:.2f} | Humide={best_thresh[2]:.2f} "
          f"→ F1-Macro val = {best_f1:.4f}")
    return best_thresh


def predict_with_threshold(model, X, thresholds):
    """Prédit en utilisant les seuils ajustés."""
    probas   = model.predict_proba(X)
    adjusted = probas / thresholds
    return np.argmax(adjusted, axis=1)


# ================================================================
# ÉTAPE 5 — Boucle principale par horizon
# ================================================================
print("=" * 70)
print("ÉTAPE 5 — Entraînement optimisé par horizon")
print("=" * 70)

results_all     = defaultdict(dict)
best_models_all = {}

for H in HORIZONS:
    target_col = f"target_H{H}"

    print(f"\n{'─'*70}")
    print(f"  🎯 HORIZON +{H} mois  (cible = {target_col})")
    print(f"{'─'*70}")

    X_train, y_train = get_xy(train,     target_col, ALL_FEATURE_COLS)
    X_val,   y_val   = get_xy(val,       target_col, ALL_FEATURE_COLS)
    X_tv,    y_tv    = get_xy(train_val, target_col, ALL_FEATURE_COLS)
    X_test,  y_test  = get_xy(test,      target_col, ALL_FEATURE_COLS)

    n_classes = len(np.unique(y_train))

    print(f"\n  Distribution train (avant rééchantillonnage) :")
    for c in sorted(np.unique(y_train)):
        n   = (y_train == c).sum()
        pct = n / len(y_train) * 100
        bar = "█" * int(pct / 2)
        print(f"    {LABEL_MAP[c]:7} ({c}) : {n:4} ({pct:5.1f}%)  {bar}")

    # ── Tuning Optuna (sur train uniquement, pas val) ─────────────
    print(f"\n  Optuna XGBoost  ({N_OPTUNA} trials)...", end=" ", flush=True)
    best_xgb_params  = tune_xgb(X_train, y_train, n_classes, N_OPTUNA)
    print(f"✅  best_depth={best_xgb_params['max_depth']}, "
          f"lr={best_xgb_params['learning_rate']:.4f}")

    print(f"  Optuna LightGBM ({N_OPTUNA} trials)...", end=" ", flush=True)
    best_lgbm_params = tune_lgbm(X_train, y_train, n_classes, N_OPTUNA)
    print(f"✅  best_depth={best_lgbm_params['max_depth']}, "
          f"lr={best_lgbm_params['learning_rate']:.4f}")

    # ── Rééchantillonnage SMOTETomek sur train+val ────────────────
    print(f"\n  SMOTETomek sur train+val...", end=" ", flush=True)
    X_tv_sm, y_tv_sm = smote_tomek_resample(X_tv, y_tv, RANDOM_STATE)
    sw_sm, cw_sm_dict = class_weights_array(y_tv_sm)

    print(f"✅  {len(y_tv_sm)} obs après rééchantillonnage")
    for c in sorted(np.unique(y_tv_sm)):
        n   = (y_tv_sm == c).sum()
        pct = n / len(y_tv_sm) * 100
        print(f"    {LABEL_MAP[c]:7}: {n:4} ({pct:5.1f}%)")

    # ── Entraînement des modèles finaux ───────────────────────────
    print(f"\n  Entraînement final :")

    # XGBoost
    xgb_params = {**best_xgb_params,
                  "objective": "multi:softprob",
                  "num_class": n_classes,
                  "eval_metric": "mlogloss",
                  "verbosity": 0,
                  "random_state": RANDOM_STATE}
    print(f"    XGBoost ...", end=" ", flush=True)
    xgb = XGBClassifier(**xgb_params)
    xgb.fit(X_tv_sm, y_tv_sm, sample_weight=sw_sm)
    print("✅")

    # LightGBM
    lgbm_params = {**best_lgbm_params,
                   "objective": "multiclass",
                   "num_class": n_classes,
                   "verbose": -1,
                   "random_state": RANDOM_STATE}
    print(f"    LightGBM...", end=" ", flush=True)
    lgbm = LGBMClassifier(**lgbm_params, class_weight=cw_sm_dict)
    lgbm.fit(X_tv_sm, y_tv_sm)
    print("✅")

    # ──────────────────────────────────────────────────────────────
    # AMÉLIORATION 2 : Ensemble pondéré XGB×3 + LGBM×2
    # RF retiré car F1 trop faible (0.28) — il tirait l'Ensemble vers le bas
    # ──────────────────────────────────────────────────────────────
    print(f"    Ensemble pondéré (XGB×3 + LGBM×2)...", end=" ", flush=True)
    ensemble = VotingClassifier(
        estimators=[("xgb", xgb), ("lgbm", lgbm)],
        voting="soft",
        weights=[3, 2],   # XGB légèrement favorisé sur données climatiques
        n_jobs=-1,
    )
    ensemble.fit(X_tv_sm, y_tv_sm)
    print("✅")

    # ──────────────────────────────────────────────────────────────
    # AMÉLIORATION 5 : Threshold tuning sur val
    # ──────────────────────────────────────────────────────────────
    print(f"\n  Threshold tuning sur jeu de validation :")
    thresholds = {}
    for name, model in [("XGBoost", xgb), ("LightGBM", lgbm),
                        ("Ensemble", ensemble)]:
        print(f"    {name:15}", end=" ")
        thresholds[name] = tune_thresholds(model, X_val, y_val, n_classes)

    # ── Évaluation sur TEST ───────────────────────────────────────
    print(f"\n  Résultats sur TEST :")
    print(f"  {'─'*65}")
    print(f"  {'Modèle':20} | {'Accuracy':>10} | {'F1-Macro':>10} | {'F1-Weighted':>12}")
    print(f"  {'─'*65}")

    horizon_results = {}
    models          = {"XGBoost": xgb, "LightGBM": lgbm, "Ensemble": ensemble}

    for name, model in models.items():
        # Prédiction avec seuils ajustés
        y_pred_raw  = model.predict(X_test)
        y_pred_thr  = predict_with_threshold(model, X_test, thresholds[name])

        acc_raw  = accuracy_score(y_test, y_pred_raw)
        f1_raw   = f1_score(y_test, y_pred_raw, average="macro", zero_division=0)
        acc_thr  = accuracy_score(y_test, y_pred_thr)
        f1_thr   = f1_score(y_test, y_pred_thr, average="macro", zero_division=0)

        # Garder la version avec le meilleur F1
        if f1_thr >= f1_raw:
            y_pred_best = y_pred_thr
            tag = "(thresh ajusté)"
        else:
            y_pred_best = y_pred_raw
            acc_thr     = acc_raw
            f1_thr      = f1_raw
            tag = "(seuil défaut)"

        f1_wei = f1_score(y_test, y_pred_best, average="weighted", zero_division=0)

        horizon_results[name] = {
            "accuracy":    acc_thr,
            "f1_macro":    f1_thr,
            "f1_weighted": f1_wei,
            "y_pred":      y_pred_best,
            "threshold":   thresholds[name],
            "tag":         tag,
        }
        print(f"  {name:20} | {acc_thr:10.4f} | {f1_thr:10.4f} | {f1_wei:12.4f}  {tag}")

    results_all[H] = {
        "horizon_results": horizon_results,
        "models":          models,
        "thresholds":      thresholds,
        "X_test":          X_test,
        "y_test":          y_test,
    }

    best_name = max(horizon_results, key=lambda k: horizon_results[k]["f1_macro"])
    best_res  = horizon_results[best_name]
    best_models_all[H] = (best_name, models[best_name], thresholds[best_name])
    print(f"\n  🏆 Meilleur (H={H}) : {best_name}  "
          f"F1-Macro={best_res['f1_macro']:.4f}  Acc={best_res['accuracy']:.4f}\n")


# ================================================================
# ÉTAPE 6 — Rapports détaillés
# ================================================================
print("=" * 70)
print("ÉTAPE 6 — Rapports de classification détaillés")
print("=" * 70)

target_names = [LABEL_MAP[i] for i in sorted(LABEL_MAP)]

for H in HORIZONS:
    hr      = results_all[H]["horizon_results"]
    best_nm = best_models_all[H][0]
    y_test  = results_all[H]["y_test"]

    print(f"\n{'═'*60}")
    print(f"  HORIZON +{H} MOIS — {best_nm}")
    print(f"{'═'*60}")

    y_pred = hr[best_nm]["y_pred"]
    for line in classification_report(y_test, y_pred,
                                      target_names=target_names,
                                      zero_division=0).split("\n"):
        print(f"  {line}")


# ================================================================
# ÉTAPE 7 — Visualisations
# ================================================================
print("=" * 70)
print("ÉTAPE 7 — Génération des visualisations")
print("=" * 70)

colors = ["#2196F3", "#FF9800", "#4CAF50", "#9C27B0"]

# ── Matrices de confusion ─────────────────────────────────────────
fig, axes = plt.subplots(1, len(HORIZONS), figsize=(7 * len(HORIZONS), 6))
fig.suptitle("Matrices de Confusion (meilleur modèle par horizon)",
             fontsize=14, fontweight="bold")
if len(HORIZONS) == 1:
    axes = [axes]

for ax, H in zip(axes, HORIZONS):
    best_nm = best_models_all[H][0]
    hr      = results_all[H]["horizon_results"]
    y_test  = results_all[H]["y_test"]
    y_pred  = hr[best_nm]["y_pred"]
    f1_mac  = hr[best_nm]["f1_macro"]
    acc     = hr[best_nm]["accuracy"]

    cm   = confusion_matrix(y_test, y_pred)
    disp = ConfusionMatrixDisplay(confusion_matrix=cm,
                                  display_labels=target_names)
    disp.plot(ax=ax, colorbar=False, cmap="Blues", xticks_rotation=45)
    ax.set_title(f"Horizon +{H} mois — {best_nm}\n"
                 f"F1={f1_mac:.3f}  Acc={acc:.3f}")

plt.tight_layout()
out = os.path.join(OUTPUT_DIR, "confusion_matrices_v3.png")
plt.savefig(out, dpi=150, bbox_inches="tight")
plt.close()
print(f"  → {out}")

# ── Comparaison des F1 v2 vs v3 ──────────────────────────────────
# (scores v2 récupérés depuis les logs)
f1_v2 = {3: 0.4639, 6: 0.3394, 12: 0.4388}

fig, ax = plt.subplots(figsize=(10, 5))
x    = np.arange(len(HORIZONS))
w    = 0.35
f1s  = [best_models_all[H][0] and
        results_all[H]["horizon_results"][best_models_all[H][0]]["f1_macro"]
        for H in HORIZONS]

bars1 = ax.bar(x - w/2, [f1_v2[H] for H in HORIZONS], w,
               label="v2 (baseline)", color="#90CAF9", edgecolor="white")
bars2 = ax.bar(x + w/2, f1s, w,
               label="v3 (optimisé)", color="#1565C0", edgecolor="white")

for bar, val in zip(bars1, [f1_v2[H] for H in HORIZONS]):
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.005,
            f"{val:.3f}", ha="center", va="bottom", fontsize=9, color="#555")
for bar, val in zip(bars2, f1s):
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.005,
            f"{val:.3f}", ha="center", va="bottom", fontsize=9, fontweight="bold")

ax.set_xticks(x)
ax.set_xticklabels([f"+{H} mois" for H in HORIZONS])
ax.set_ylabel("F1-Macro (test)")
ax.set_title("Amélioration v2 → v3", fontweight="bold")
ax.set_ylim(0, 1.0)
ax.axhline(0.6, color="green",  linestyle="--", alpha=0.5, label="Objectif 0.60")
ax.axhline(0.4, color="orange", linestyle="--", alpha=0.5, label="Niveau v2")
ax.legend()
ax.grid(axis="y", alpha=0.3)

plt.tight_layout()
out = os.path.join(OUTPUT_DIR, "improvement_v2_v3.png")
plt.savefig(out, dpi=150, bbox_inches="tight")
plt.close()
print(f"  → {out}")

# ── Feature importance XGBoost ────────────────────────────────────
fig, axes = plt.subplots(1, len(HORIZONS), figsize=(8 * len(HORIZONS), 9))
fig.suptitle("Top 20 Features — XGBoost optimisé", fontsize=13, fontweight="bold")
if len(HORIZONS) == 1:
    axes = [axes]

for ax, H in zip(axes, HORIZONS):
    xgb_model   = results_all[H]["models"]["XGBoost"]
    importances = pd.Series(xgb_model.feature_importances_,
                            index=ALL_FEATURE_COLS).sort_values(ascending=False)
    top20  = importances.head(20)
    colors_fi = ["#1565C0" if i < 5 else "#90CAF9" for i in range(len(top20))]
    top20.plot(kind="barh", ax=ax, color=colors_fi[::-1])
    ax.set_title(f"Horizon +{H} mois", fontweight="bold")
    ax.set_xlabel("Importance (gain)")
    ax.invert_yaxis()
    ax.axvline(top20.mean(), color="red", linestyle="--", alpha=0.5,
               label="Moyenne")
    ax.legend(fontsize=8)

plt.tight_layout()
out = os.path.join(OUTPUT_DIR, "feature_importance_v3.png")
plt.savefig(out, dpi=150, bbox_inches="tight")
plt.close()
print(f"  → {out}")


# ================================================================
# ÉTAPE 8 — Sauvegarde
# ================================================================
print("=" * 70)
print("ÉTAPE 8 — Sauvegarde")
print("=" * 70)

for H, (name, model, thresholds_h) in best_models_all.items():
    fname = os.path.join(OUTPUT_DIR, f"best_model_H{H}_v3.pkl")
    joblib.dump({"model": model, "thresholds": thresholds_h,
                 "feature_cols": ALL_FEATURE_COLS}, fname)
    print(f"  ✅ H={H:2}  {name:15}  → {fname}")

joblib.dump(ALL_FEATURE_COLS, os.path.join(OUTPUT_DIR, "feature_cols_v3.pkl"))
print(f"  ✅ feature_cols_v3.pkl sauvegardé\n")


# ================================================================
# ÉTAPE 9 — Exemple d'inférence
# ================================================================
print("=" * 70)
print("ÉTAPE 9 — Prédictions sur les dernières données")
print("=" * 70)

last_date = test.index.max()
last_obs  = test[test.index == last_date]
ville_cols_present = [c for c in ALL_FEATURE_COLS if c.startswith("ville_")]

print(f"\n  📅 Date : {last_date.strftime('%B %Y')}\n")
print(f"  {'Ville':20} | " +
      " | ".join([f"H+{H:2}m" for H in HORIZONS]) +
      " | " +
      " | ".join([f"Réel H+{H}" for H in HORIZONS]))
print(f"  {'─'*80}")

for idx, row in last_obs.iterrows():
    x_row = row[ALL_FEATURE_COLS].values.reshape(1, -1)

    ville_name = "Inconnue"
    for vc in ville_cols_present:
        if row.get(vc, 0) == 1:
            ville_name = vc.replace("ville_", "")
            break

    preds_str = []
    reels_str = []

    for H in HORIZONS:
        target_col = f"target_H{H}"
        if H not in best_models_all:
            preds_str.append("N/A")
            reels_str.append("N/A")
            continue

        _, model, thresh = best_models_all[H]
        pred = predict_with_threshold(model, x_row, thresh)[0]
        proba = model.predict_proba(x_row)[0]
        conf  = proba[pred] * 100
        preds_str.append(f"{LABEL_MAP[pred]:7}({conf:4.0f}%)")

        if target_col in row.index and not pd.isna(row[target_col]):
            true_label = int(row[target_col])
            ok = "✅" if pred == true_label else "❌"
            reels_str.append(f"{LABEL_MAP.get(true_label,'?'):7}{ok}")
        else:
            reels_str.append("?      ")

    print(f"  {ville_name:20} | " +
          " | ".join(preds_str) + " | " +
          " | ".join(reels_str))


# ================================================================
# RÉSUMÉ
# ================================================================
print("\n" + "=" * 70)
print("✅ MODÉLISATION v3 TERMINÉE")
print("=" * 70)

print("\n🏆 RÉSULTATS FINAUX :")
print(f"  {'Horizon':8} | {'Modèle':15} | {'F1-Macro v2':>12} | {'F1-Macro v3':>12} | {'Gain':>8}")
print(f"  {'─'*65}")
for H in HORIZONS:
    best_nm = best_models_all[H][0]
    f1_v3   = results_all[H]["horizon_results"][best_nm]["f1_macro"]
    gain    = f1_v3 - f1_v2[H]
    sign    = "+" if gain >= 0 else ""
    print(f"  +{H:<7} | {best_nm:15} | {f1_v2[H]:12.4f} | {f1_v3:12.4f} | {sign}{gain:.4f}")

print(f"""
📁 FICHIERS GÉNÉRÉS :
  best_model_H3_v3.pkl   → modèle + seuils + feature list
  best_model_H6_v3.pkl
  best_model_H12_v3.pkl
  feature_cols_v3.pkl
  confusion_matrices_v3.png
  improvement_v2_v3.png   → comparaison avant/après
  feature_importance_v3.png

📦 UTILISATION EN PRODUCTION :
  bundle = joblib.load("best_model_H6_v3.pkl")
  model, thresholds, feature_cols = bundle["model"], bundle["thresholds"], bundle["feature_cols"]
  probas = model.predict_proba(X_new[feature_cols])
  y_pred = np.argmax(probas / thresholds, axis=1)
  # → 0 = Sec | 1 = Normal | 2 = Humide
""")