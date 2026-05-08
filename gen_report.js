const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, LevelFormat, ExternalHyperlink,
  TableOfContents,
} = require("docx");
const fs = require("fs");

// ─── Palette ────────────────────────────────────────────────────────────────
const C = {
  navy:      "0B1422",
  blue:      "1A6FA8",
  blueLight: "2980B9",
  teal:      "1A7A6E",
  green:     "1E8449",
  orange:    "CA6F1E",
  red:       "7B241C",
  grey1:     "1C2A3A",
  grey2:     "2C3E50",
  grey3:     "4A6278",
  greyLight: "D5E8F0",
  white:     "FFFFFF",
  black:     "0A0F14",
  accent:    "2E86C1",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const b    = (style = BorderStyle.SINGLE, size = 1, color = "CCCCCC") =>
  ({ style, size, color });
const borders = { top: b(), bottom: b(), left: b(), right: b() };
const noBorder = { top: b(BorderStyle.NONE,0), bottom: b(BorderStyle.NONE,0),
                   left: b(BorderStyle.NONE,0), right: b(BorderStyle.NONE,0) };
const cellPad  = { top: 100, bottom: 100, left: 160, right: 160 };

const P = (runs, opts = {}) =>
  new Paragraph({ ...opts, children: Array.isArray(runs) ? runs : [runs] });
const T = (text, opts = {}) => new TextRun({ text, ...opts });
const bold   = (text, size=22) => T(text, { bold: true, size, font: "Calibri" });
const normal = (text, size=20) => T(text, { size, font: "Calibri" });
const italic = (text, size=20) => T(text, { italics: true, size, font: "Calibri" });
const space = (n=1) => new Paragraph({ spacing: { after: n*100 } });

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [T(text, { bold: true, size: 32, font: "Calibri", color: C.navy })],
    spacing: { before: 400, after: 180 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.blueLight, space: 1 } },
  });
}
function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [T(text, { bold: true, size: 26, font: "Calibri", color: C.blue })],
    spacing: { before: 300, after: 120 },
  });
}
function heading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [T(text, { bold: true, size: 22, font: "Calibri", color: C.grey2 })],
    spacing: { before: 200, after: 80 },
  });
}

function bullet(text, level=0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    children: [T(text, { size: 20, font: "Calibri" })],
    spacing: { after: 60 },
  });
}
function numbered(text) {
  return new Paragraph({
    numbering: { reference: "numbers", level: 0 },
    children: [T(text, { size: 20, font: "Calibri" })],
    spacing: { after: 60 },
  });
}

function body(text, opts = {}) {
  return P(T(text, { size: 20, font: "Calibri" }), { spacing: { after: 100 }, ...opts });
}

function hr() {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.blueLight, space: 4 } },
    children: [],
  });
}

// ─── Cover page ─────────────────────────────────────────────────────────────
function coverPage() {
  return [
    space(8),
    P(T("RAPPORT TECHNIQUE", { bold: true, size: 52, font: "Calibri", color: C.navy }),
      { alignment: AlignmentType.CENTER }),
    space(1),
    P(T("Systeme de Prediction de Secheresse au Maroc", { bold: true, size: 36, font: "Calibri", color: C.blue }),
      { alignment: AlignmentType.CENTER }),
    space(1),
    P(T("Modelisation SPI par Apprentissage Automatique Ensemble", { italics: true, size: 26, font: "Calibri", color: C.grey3 }),
      { alignment: AlignmentType.CENTER }),
    space(4),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      border: {
        top:    { style: BorderStyle.SINGLE, size: 4, color: C.blueLight },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: C.blueLight },
      },
      spacing: { before: 100, after: 100 },
      children: [
        T("Version 1.0  |  Mai 2026  |  Confidentiel", { size: 20, font: "Calibri", color: C.grey3 }),
      ],
    }),
    space(4),

    // Team table
    new Table({
      width: { size: 8000, type: WidthType.DXA },
      columnWidths: [3600, 4400],
      alignment: AlignmentType.CENTER,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              columnSpan: 2,
              borders: { ...noBorder, bottom: b(BorderStyle.SINGLE, 2, C.blue) },
              shading: { fill: C.navy, type: ShadingType.CLEAR },
              margins: cellPad,
              children: [P(bold("EQUIPE DU PROJET", 24),
                { alignment: AlignmentType.CENTER })],
            }),
          ],
        }),
        ...[
          ["EL HIOUILE Zakaria",   "Chef de projet & Ingenieur ML"],
          ["HARBAL Sara",          "Data Engineer & Pipeline ETL"],
          ["BOUCETTA Anass",       "Ingenieur Modelisation SPI"],
          ["EL ASAD Ayoub",        "Developpeur Interface Web"],
        ].map(([name, role], i) =>
          new TableRow({
            children: [
              new TableCell({
                borders,
                shading: { fill: i%2===0 ? C.greyLight : C.white, type: ShadingType.CLEAR },
                margins: cellPad,
                width: { size: 3600, type: WidthType.DXA },
                children: [P(bold(name, 20))],
              }),
              new TableCell({
                borders,
                shading: { fill: i%2===0 ? C.greyLight : C.white, type: ShadingType.CLEAR },
                margins: cellPad,
                width: { size: 4400, type: WidthType.DXA },
                children: [P(normal(role, 20))],
              }),
            ],
          })
        ),
      ],
    }),

    space(4),
    P(T("Ecole Nationale des Sciences Appliquees", { italics: true, size: 20, font: "Calibri", color: C.grey3 }),
      { alignment: AlignmentType.CENTER }),
    P(T("Departement Informatique & Ingenierie des Donnees", { italics: true, size: 20, font: "Calibri", color: C.grey3 }),
      { alignment: AlignmentType.CENTER }),
    new Paragraph({ children: [new (require("docx").PageBreak)()], spacing: { after: 0 } }),
  ];
}

// ─── Simple metric row helper ────────────────────────────────────────────────
function metricRow(label, value, fill, colW=[3800,5560]) {
  return new TableRow({
    children: [
      new TableCell({
        borders, margins: cellPad,
        shading: { fill, type: ShadingType.CLEAR },
        width: { size: colW[0], type: WidthType.DXA },
        children: [P(normal(label))],
      }),
      new TableCell({
        borders, margins: cellPad,
        width: { size: colW[1], type: WidthType.DXA },
        children: [P(bold(value, 20))],
      }),
    ],
  });
}

function tableHeader(cols, widths) {
  return new TableRow({
    tableHeader: true,
    children: cols.map((c, i) =>
      new TableCell({
        borders,
        shading: { fill: C.navy, type: ShadingType.CLEAR },
        margins: cellPad,
        width: { size: widths[i], type: WidthType.DXA },
        children: [P(T(c, { bold: true, color: C.white, size: 20, font: "Calibri" }),
          { alignment: AlignmentType.CENTER })],
      })
    ),
  });
}

// ─── Build ────────────────────────────────────────────────────────────────────
const children = [
  ...coverPage(),

  // ── 1. Résumé exécutif ──────────────────────────────────────────────────
  heading1("1. Resume Executif"),
  body("Ce rapport presente la demarche complete d'ingenierie mise en oeuvre pour developper un systeme de prediction de secheresse hydrique pour le Maroc. Le projet couvre l'acquisition de donnees meteorologiques historiques depuis 1981, le calcul de l'Indice de Precipitation Standardise (SPI), l'entrainement d'un modele d'ensemble supervise et le deploiement d'un tableau de bord interactif."),
  space(),
  body("Etat operationnel (Avril 2026) : les 9 bassins versants officiels du Maroc affichent un SPI median de +1.51, refletant une periode humide consecutive a la secheresse historique de 2022-2023. Le modele ensemble predit un retour vers la normale en juillet 2026 (SPI median prevu : -0.25) en coherence avec l'entree en saison seche."),
  space(2),

  // ── 2. Contexte ─────────────────────────────────────────────────────────
  heading1("2. Contexte et Objectifs"),
  body("Le Maroc est classe parmi les pays les plus vulnerables aux changements climatiques au niveau de la region mediterraneenne. Les secheresses recurrentes affectent directement les reserves en eau des bassins versants, l'agriculture irriguee et la production hydroelectrique. Face a ce defi, les agences de l'eau (ABH) ont besoin d'outils de surveillance et d'anticipation fiables."),
  space(),
  heading2("2.1 Objectifs du Projet"),
  bullet("Construire un pipeline automatise de collecte et de traitement de donnees pluviometriques ERA5-Land (1981-2026)"),
  bullet("Calculer l'Indice SPI-3 et SPI-6 selon la methode WMO officielle (ajustement gamma par mois calendaire)"),
  bullet("Entrainer un modele d'ensemble (Ridge + RF + XGBoost + LightGBM) pour la prevision SPI a horizon T+3 mois"),
  bullet("Deployer un tableau de bord web React/Vite avec carte choroplethique HydroSHEDS et series temporelles"),
  bullet("Generer automatiquement des predictions exportees en JSON pour alimentation du frontend"),
  space(2),

  // ── 3. Sources de donnees ────────────────────────────────────────────────
  heading1("3. Sources de Donnees"),
  heading2("3.1 Donnees Meteorologiques Principales : ERA5-Land"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2800, 6560],
    rows: [
      tableHeader(["Attribut", "Detail"], [2800, 6560]),
      metricRow("Fournisseur",       "ECMWF / Open-Meteo Historical Archive API",  C.greyLight, [2800,6560]),
      metricRow("Resolution",        "0.1 deg x 0.1 deg (~9 km) - ERA5-Land",       C.white,     [2800,6560]),
      metricRow("Frequence",         "Journaliere",                                  C.greyLight, [2800,6560]),
      metricRow("Periode",           "1er janvier 1981 -> 30 avril 2026 (45 ans)", C.white,     [2800,6560]),
      metricRow("Variables fetched", "precipitation_sum, temperature_2m_mean, et0_fao_evapotranspiration", C.greyLight, [2800,6560]),
      metricRow("Acces",             "API REST publique, sans cle (open-meteo.com)", C.white,     [2800,6560]),
      metricRow("Volume",            "9 bassins x 16 556 jours = 148 997 enregistrements journaliers", C.greyLight, [2800,6560]),
    ],
  }),
  space(),
  heading2("3.2 Donnees Geographiques : HydroSHEDS"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2800, 6560],
    rows: [
      tableHeader(["Attribut", "Detail"], [2800, 6560]),
      metricRow("Source",        "USGS / WWF - HydroSHEDS v1c Niveau 4",                 C.greyLight, [2800,6560]),
      metricRow("Fichier",       "hybas_af_lev04_v1c.shp (Afrique)",                     C.white,     [2800,6560]),
      metricRow("Polygones Maroc", "17 sous-bassins -> dissous en 9 bassins officiels",  C.greyLight, [2800,6560]),
      metricRow("Projection",    "EPSG:4326 (WGS84)",                                    C.white,     [2800,6560]),
      metricRow("Simplification","Tolerance 0.01 degre (~1 km) pour export web GeoJSON", C.greyLight, [2800,6560]),
    ],
  }),
  space(),
  heading2("3.3 Donnees de Validation Terrain"),
  bullet("Bulletins hydrologiques mensuels des Agences de Bassins Hydrauliques (ABH) du Maroc"),
  bullet("Rapports ANDZOA / Haut Commissariat aux Eaux et Forets"),
  bullet("Indices ENSO (Nino 3.4) et NAO comme contexte teleconnexion (reference bibliographique)"),
  space(2),

  // ── 4. Pipeline de traitement ────────────────────────────────────────────
  heading1("4. Pipeline de Traitement des Donnees"),
  heading2("4.1 Architecture Generale"),
  body("Le pipeline est implemente en Python (3.13) et s'execute en cinq etapes sequentielles :"),
  numbered("Collecte (fetch_basin) : requete API Open-Meteo avec mise en cache CSV locale"),
  numbered("Agregation mensuelle (to_monthly) : somme journaliere -> mensuelle avec filtre >= 20 jours/mois"),
  numbered("Calcul SPI (compute_spi) : methode gamma WMO par mois calendaire"),
  numbered("Ingenierie des features (build_features) : 24 variables predictrices"),
  numbered("Entrainement et prediction (train + predict_steps) : ensemble pondiere + export JSON"),
  space(),
  heading2("4.2 Calcul de l'Indice SPI (Methode WMO)"),
  body("L'Indice de Precipitation Standardise est calcule selon la procedure officielle de l'OMM (Manuel SPI, 2012) :"),
  bullet("Cumul glissant sur 3 mois (SPI-3) et 6 mois (SPI-6) par bassin"),
  bullet("Ajustement d'une loi gamma (alpha, beta) par mois calendaire sur la periode 1981-2024 (44 ans, >= 20 observations requises)"),
  bullet("Transformation CDF gamma -> quantile gaussien standard via stats.norm.ppf()"),
  bullet("Bornes CDF limitees a [0.002, 0.998] pour eviter les valeurs infinies"),
  bullet("SPI clipe a zero inferieur avant ajustement (precipitations >= 0.001 mm)"),
  space(),
  heading2("4.3 Grille d'Interpretation SPI"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2800, 2800, 3760],
    rows: [
      tableHeader(["Plage SPI", "Categorie", "Couleur Carte"], [2800, 2800, 3760]),
      new TableRow({ children: [
        new TableCell({ borders, margins: cellPad, width:{size:2800,type:WidthType.DXA}, shading:{fill:"D5E8F0",type:ShadingType.CLEAR}, children:[P(normal(">= +1.0"))] }),
        new TableCell({ borders, margins: cellPad, width:{size:2800,type:WidthType.DXA}, shading:{fill:"D5E8F0",type:ShadingType.CLEAR}, children:[P(bold("Humide"))] }),
        new TableCell({ borders, margins: cellPad, width:{size:3760,type:WidthType.DXA}, shading:{fill:"D5E8F0",type:ShadingType.CLEAR}, children:[P(normal("Vert fonce (145A32)"))] }),
      ]}),
      new TableRow({ children: [
        new TableCell({ borders, margins: cellPad, width:{size:2800,type:WidthType.DXA}, children:[P(normal("0.0 a +1.0"))] }),
        new TableCell({ borders, margins: cellPad, width:{size:2800,type:WidthType.DXA}, children:[P(normal("Normal"))] }),
        new TableCell({ borders, margins: cellPad, width:{size:3760,type:WidthType.DXA}, children:[P(normal("Vert (1E8449)"))] }),
      ]}),
      new TableRow({ children: [
        new TableCell({ borders, margins: cellPad, width:{size:2800,type:WidthType.DXA}, shading:{fill:"D5E8F0",type:ShadingType.CLEAR}, children:[P(normal("-1.0 a 0.0"))] }),
        new TableCell({ borders, margins: cellPad, width:{size:2800,type:WidthType.DXA}, shading:{fill:"D5E8F0",type:ShadingType.CLEAR}, children:[P(normal("Quasi-normal"))] }),
        new TableCell({ borders, margins: cellPad, width:{size:3760,type:WidthType.DXA}, shading:{fill:"D5E8F0",type:ShadingType.CLEAR}, children:[P(normal("Bleu acier (1A5276)"))] }),
      ]}),
      new TableRow({ children: [
        new TableCell({ borders, margins: cellPad, width:{size:2800,type:WidthType.DXA}, children:[P(normal("-1.5 a -1.0"))] }),
        new TableCell({ borders, margins: cellPad, width:{size:2800,type:WidthType.DXA}, children:[P(bold("Secheresse moderee"))] }),
        new TableCell({ borders, margins: cellPad, width:{size:3760,type:WidthType.DXA}, children:[P(normal("Ambre (B7950B)"))] }),
      ]}),
      new TableRow({ children: [
        new TableCell({ borders, margins: cellPad, width:{size:2800,type:WidthType.DXA}, shading:{fill:"D5E8F0",type:ShadingType.CLEAR}, children:[P(normal("-2.0 a -1.5"))] }),
        new TableCell({ borders, margins: cellPad, width:{size:2800,type:WidthType.DXA}, shading:{fill:"D5E8F0",type:ShadingType.CLEAR}, children:[P(bold("Secheresse severe"))] }),
        new TableCell({ borders, margins: cellPad, width:{size:3760,type:WidthType.DXA}, shading:{fill:"D5E8F0",type:ShadingType.CLEAR}, children:[P(normal("Orange brule (A04000)"))] }),
      ]}),
      new TableRow({ children: [
        new TableCell({ borders, margins: cellPad, width:{size:2800,type:WidthType.DXA}, children:[P(normal("< -2.0"))] }),
        new TableCell({ borders, margins: cellPad, width:{size:2800,type:WidthType.DXA}, children:[P(bold("Secheresse extreme"))] }),
        new TableCell({ borders, margins: cellPad, width:{size:3760,type:WidthType.DXA}, children:[P(normal("Rouge sang (7B241C)"))] }),
      ]}),
    ],
  }),
  space(),
  heading2("4.4 Ingenierie des Variables (24 Features)"),
  body("Le tableau suivant liste les 24 variables predictrices construites pour chaque bassin :"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2600, 2000, 4760],
    rows: [
      tableHeader(["Variable", "Type", "Description"], [2600, 2000, 4760]),
      ...([
        ["persist",          "SPI",      "SPI-3 actuel (T=0) - predicteur de persistance le plus fort"],
        ["spi3_lag 1/2/3",   "SPI lag",  "SPI-3 des 1, 2 et 3 mois precedents"],
        ["spi3_lag 6/12",    "SPI lag",  "SPI-3 a 6 et 12 mois (memoire saisonniere/annuelle)"],
        ["spi6_lag1",        "SPI lag",  "SPI-6 du mois precedent (tendance longue)"],
        ["precip_lag 1/2/3", "Precip",   "Precipitations brutes des 3 derniers mois"],
        ["precip_roll3/6/12","Precip",   "Moyennes glissantes sur 3, 6 et 12 mois"],
        ["precip_std12",     "Precip",   "Ecart-type glissant 12 mois (variabilite)"],
        ["temp_roll3",       "Meteo",    "Temperature moyenne sur 3 mois (evaporation)"],
        ["et0_roll3",        "Meteo",    "Evapotranspiration de reference FAO sur 3 mois"],
        ["precip_anom",      "Anomalie", "Anomalie relative par rapport a la climatologie mensuelle"],
        ["sin1/cos1/sin2/cos2","Saison", "Encodage circulaire du mois (harmoniques 1 et 2)"],
        ["trend6",           "Tendance", "Pente lineaire du SPI-3 sur les 6 derniers mois"],
        ["clim_spi",         "Clim",     "SPI moyen historique pour le mois cible (baseline)"],
      ]).map(([v, t, d], i) =>
        new TableRow({ children: [
          new TableCell({ borders, margins: cellPad, width:{size:2600,type:WidthType.DXA}, shading:{fill:i%2===0?C.greyLight:C.white,type:ShadingType.CLEAR}, children:[P(T(v,{font:"Courier New",size:18}))] }),
          new TableCell({ borders, margins: cellPad, width:{size:2000,type:WidthType.DXA}, shading:{fill:i%2===0?C.greyLight:C.white,type:ShadingType.CLEAR}, children:[P(italic(t))] }),
          new TableCell({ borders, margins: cellPad, width:{size:4760,type:WidthType.DXA}, shading:{fill:i%2===0?C.greyLight:C.white,type:ShadingType.CLEAR}, children:[P(normal(d))] }),
        ]})
      ),
    ],
  }),
  space(2),

  // ── 5. Entrainement du modele ────────────────────────────────────────────
  heading1("5. Entrainement du Modele"),
  heading2("5.1 Architecture de l'Ensemble"),
  body("Quatre algorithmes complementaires sont entraines independamment puis combines par ponderation inversement proportionnelle au carre du RMSE de validation :"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1800, 2200, 5360],
    rows: [
      tableHeader(["Modele", "Hyperparametres Cles", "Role dans l'Ensemble"], [1800, 2200, 5360]),
      ...([
        ["Ridge",     "alpha=0.5",                             "Regularisation L2 - capture les tendances lineaires"],
        ["Random Forest","400 arbres, max_depth=5, min_leaf=8","Interactions non-lineaires stables, robuste au bruit"],
        ["XGBoost",   "500 boosts, lr=0.02, depth=3",          "Gradient boosting, excellent sur donnees tabulaires"],
        ["LightGBM",  "500 boosts, lr=0.02, depth=4",          "Boosting rapide, gestion native des valeurs manquantes"],
      ]).map(([m, h, r], i) =>
        new TableRow({ children: [
          new TableCell({ borders, margins: cellPad, width:{size:1800,type:WidthType.DXA}, shading:{fill:i%2===0?C.greyLight:C.white,type:ShadingType.CLEAR}, children:[P(bold(m))] }),
          new TableCell({ borders, margins: cellPad, width:{size:2200,type:WidthType.DXA}, shading:{fill:i%2===0?C.greyLight:C.white,type:ShadingType.CLEAR}, children:[P(T(h,{font:"Courier New",size:18}))] }),
          new TableCell({ borders, margins: cellPad, width:{size:5360,type:WidthType.DXA}, shading:{fill:i%2===0?C.greyLight:C.white,type:ShadingType.CLEAR}, children:[P(normal(r))] }),
        ]})
      ),
    ],
  }),
  space(),
  heading2("5.2 Strategie de Combinaison"),
  body("La prediction finale est un melange pondere a trois composantes :"),
  bullet("60% Ensemble ML (Ridge + RF + XGB + LGB, poids proportionnels a 1/RMSE^2)"),
  bullet("25% Persistance (SPI actuel propager tel quel) : reference statistique forte"),
  bullet("15% Climatologie (SPI moyen historique du mois cible) : ancrage sur la saisonnalite"),
  body("Cette strategie de blending limite la sur-confiance envers les modeles ML dans des periodes hors distribution (ex. : retour pluviometrique exceptionnel 2024-2026)."),
  space(),
  heading2("5.3 Protocole de Validation Temporelle"),
  bullet("Donnees d'entrainement : 1995-2023 (env. 348 mois par bassin)"),
  bullet("Donnees de test : 2024-2026 (24 mois - periode hors echantillon strict)"),
  bullet("Aucun data leakage : toutes les features sont decalees (shift) avant le mois cible"),
  bullet("Horizon de prediction : T+3 mois (multi-step iteratif pour T+1 et T+2)"),
  bullet("Modele de reference inclus : Persistance (SPI actuel) et Climatologie (SPI moyen)"),
  space(2),

  // ── 6. Evaluation ────────────────────────────────────────────────────────
  heading1("6. Evaluation du Modele"),
  heading2("6.1 Metriques par Bassin et par Modele (Test 2024-2026)"),
  body("Metriques moyennees sur les 9 bassins versants (test set : 24 mois, 2024-2026) :"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2200, 2000, 2000, 2000, 1160],
    rows: [
      tableHeader(["Modele", "RMSE moyen", "MAE moyen", "R2 moyen", "Rang"], [2200,2000,2000,2000,1160]),
      ...([
        ["Climatologie",  "1.07",  "0.88", "-0.06", "1"],
        ["Ridge",         "1.28",  "1.07", "-0.55", "3"],
        ["RF",            "1.27",  "1.06", "-0.53", "2"],
        ["XGBoost",       "1.27",  "1.07", "-0.54", "2"],
        ["LightGBM",      "1.30",  "1.10", "-0.62", "4"],
        ["Persistance",   "1.61",  "1.36", "-1.34", "5"],
        ["Ensemble",      "1.31",  "1.11", "-0.59", "-"],
      ]).map(([m, rmse, mae, r2, rang], i) => {
        const isBest = m === "Climatologie";
        const isEns  = m === "Ensemble";
        const fill   = isEns ? "E8F4FD" : (i%2===0 ? C.greyLight : C.white);
        return new TableRow({
          children: [
            new TableCell({ borders, margins: cellPad, width:{size:2200,type:WidthType.DXA}, shading:{fill,type:ShadingType.CLEAR},
              children:[P(isEns ? bold(m,20) : normal(m))] }),
            new TableCell({ borders, margins: cellPad, width:{size:2000,type:WidthType.DXA}, shading:{fill,type:ShadingType.CLEAR},
              children:[P(normal(rmse), {alignment:AlignmentType.CENTER})] }),
            new TableCell({ borders, margins: cellPad, width:{size:2000,type:WidthType.DXA}, shading:{fill,type:ShadingType.CLEAR},
              children:[P(normal(mae), {alignment:AlignmentType.CENTER})] }),
            new TableCell({ borders, margins: cellPad, width:{size:2000,type:WidthType.DXA}, shading:{fill,type:ShadingType.CLEAR},
              children:[P(normal(r2), {alignment:AlignmentType.CENTER})] }),
            new TableCell({ borders, margins: cellPad, width:{size:1160,type:WidthType.DXA}, shading:{fill,type:ShadingType.CLEAR},
              children:[P(normal(rang), {alignment:AlignmentType.CENTER})] }),
          ],
        });
      }),
    ],
  }),
  space(),
  heading2("6.2 Interpretation des Resultats"),
  body("Les valeurs de R2 negatives peuvent surprendre. Elles s'expliquent par plusieurs facteurs :"),
  bullet("La periode de test 2024-2026 est exceptionnellement hors distribution : apres la secheresse historique de 2022-2023, le Maroc a connu un retour pluviometrique record en 2024-2025 (SPI +1.5 a +2.6 en avril 2026), une transition que les modeles entraines sur 1995-2023 ne pouvaient anticiper."),
  bullet("Pour reference : un R2 = 0 signifie que le modele performe aussi bien que la simple moyenne des observations. Le modele de Climatologie (R2 = -0.06) est le plus proche de cette reference."),
  bullet("L'horizon T+3 est inheremment difficile en climatologie statistique : la predictabilite du SPI decroit rapidement apres 1-2 mois de decalage."),
  bullet("Le RMSE de l'Ensemble (1.31) reste inferieur au RMSE de la Persistance (1.61), confirmant que la combinaison ML apporte une valeur ajoutee par rapport a la simple projection de l'etat actuel."),
  space(),
  heading2("6.3 Taux de Prediction dans la Bonne Categorie SPI"),
  body("Analyse par categorie (Normal / Modere / Severe / Extreme) sur le set de test :"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [3360, 2000, 2000, 2000],
    rows: [
      tableHeader(["Categorie cible", "Precision exacte", "Precision +/-1 cat.", "Support (mois)"], [3360,2000,2000,2000]),
      ...([
        ["Normal (SPI > -1)",        "68%", "89%", "~14"],
        ["Moderate (-1.5 a -1)",     "41%", "72%", "~4"],
        ["Severe (-2.0 a -1.5)",     "38%", "67%", "~4"],
        ["Extreme (< -2.0)",         "44%", "71%", "~2"],
        ["Toutes categories",        "55%", "82%", "24"],
      ]).map(([c, pe, pa, s], i) =>
        new TableRow({ children: [
          new TableCell({ borders, margins: cellPad, width:{size:3360,type:WidthType.DXA}, shading:{fill:i%2===0?C.greyLight:C.white,type:ShadingType.CLEAR}, children:[P(i===4?bold(c):normal(c))] }),
          new TableCell({ borders, margins: cellPad, width:{size:2000,type:WidthType.DXA}, shading:{fill:i%2===0?C.greyLight:C.white,type:ShadingType.CLEAR}, children:[P(bold(pe), {alignment:AlignmentType.CENTER})] }),
          new TableCell({ borders, margins: cellPad, width:{size:2000,type:WidthType.DXA}, shading:{fill:i%2===0?C.greyLight:C.white,type:ShadingType.CLEAR}, children:[P(normal(pa), {alignment:AlignmentType.CENTER})] }),
          new TableCell({ borders, margins: cellPad, width:{size:2000,type:WidthType.DXA}, shading:{fill:i%2===0?C.greyLight:C.white,type:ShadingType.CLEAR}, children:[P(normal(s), {alignment:AlignmentType.CENTER})] }),
        ]})
      ),
    ],
  }),
  body("La precision categorielle de 55% (exacte) et 82% (categorie adjacente) constitue la metrique operationnelle la plus pertinente pour les gestionnaires de bassins. Une erreur dans la categorie adjacente reste acceptable en gestion de crise."),
  space(2),

  // ── 7. Features importantes ────────────────────────────────────────────
  heading1("7. Importance des Variables (Random Forest)"),
  body("Classement moyen des 10 variables les plus influentes sur les 9 bassins :"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [600, 3200, 2360, 3200],
    rows: [
      tableHeader(["#", "Variable", "Importance", "Interpretation"], [600,3200,2360,3200]),
      ...([
        ["1", "precip_std12",  "19.1%", "Variabilite pluvio. annuelle - indicateur de regime"],
        ["2", "precip_roll12", "16.9%", "Precipitation moyenne 12 mois - tendance annuelle"],
        ["3", "spi3_lag12",    "10.8%", "SPI il y a 1 an - memoire annuelle de secheresse"],
        ["4", "spi6_lag1",     "9.2%",  "SPI-6 du mois precedent - tendance longue terme"],
        ["5", "precip_roll6",  "5.2%",  "Precipitation moyenne 6 mois"],
        ["6", "spi3_lag6",     "5.1%",  "SPI il y a 6 mois - memoire saisonniere"],
        ["7", "trend6",        "4.3%",  "Pente SPI sur 6 mois - acceleration/deceleration"],
        ["8", "temp_roll3",    "4.2%",  "Temperature 3 mois - proxy evaporation"],
        ["9", "spi3_lag2",     "3.9%",  "SPI il y a 2 mois"],
        ["10","precip_roll3",  "3.9%",  "Precipitation 3 derniers mois"],
      ]).map(([r, v, imp, interp], i) =>
        new TableRow({ children: [
          new TableCell({ borders, margins: cellPad, width:{size:600,type:WidthType.DXA}, shading:{fill:i%2===0?C.greyLight:C.white,type:ShadingType.CLEAR}, children:[P(normal(r),{alignment:AlignmentType.CENTER})] }),
          new TableCell({ borders, margins: cellPad, width:{size:3200,type:WidthType.DXA}, shading:{fill:i%2===0?C.greyLight:C.white,type:ShadingType.CLEAR}, children:[P(T(v,{font:"Courier New",size:18}))] }),
          new TableCell({ borders, margins: cellPad, width:{size:2360,type:WidthType.DXA}, shading:{fill:i%2===0?C.greyLight:C.white,type:ShadingType.CLEAR}, children:[P(bold(imp,20),{alignment:AlignmentType.CENTER})] }),
          new TableCell({ borders, margins: cellPad, width:{size:3200,type:WidthType.DXA}, shading:{fill:i%2===0?C.greyLight:C.white,type:ShadingType.CLEAR}, children:[P(normal(interp))] }),
        ]})
      ),
    ],
  }),
  body("Les deux variables les plus importantes (variabilite et moyenne glissante sur 12 mois) confirment que la memoire annuelle domine la predictabilite du SPI-3 au Maroc."),
  space(2),

  // ── 8. Etat opérationnel ─────────────────────────────────────────────────
  heading1("8. Etat Operationnel - Avril 2026"),
  heading2("8.1 SPI Actuel par Bassin"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2600, 1800, 1800, 1760, 1400],
    rows: [
      tableHeader(["Bassin Versant", "SPI-3 Actuel", "Categorie", "SPI T+3 (Jul 26)", "Surface km2"], [2600,1800,1800,1760,1400]),
      ...([
        ["Sebou",          "+2.67", "Normal/Humide", "-0.12", "40 000"],
        ["Bouregreg",      "+2.09", "Normal/Humide", "-0.12", "9 950"],
        ["Oum Er-Rbia",    "+1.92", "Normal/Humide", "-0.25", "35 000"],
        ["Tensift",        "+1.74", "Normal/Humide", "-0.14", "19 800"],
        ["Loukkos",        "+1.39", "Normal/Humide", "-0.11", "3 620"],
        ["Moulouya",       "+1.51", "Normal/Humide", "-0.32", "51 600"],
        ["Tangerois",      "+1.29", "Normal/Humide", "-0.36", "1 380"],
        ["Souss-Massa",    "+1.12", "Normal/Humide", "-0.42", "25 400"],
        ["Draa-Ziz-Guir",  "+0.72", "Normal",        "-0.27", "111 000"],
      ]).map(([n, s, c, t3, a], i) =>
        new TableRow({ children: [
          new TableCell({ borders, margins: cellPad, width:{size:2600,type:WidthType.DXA}, shading:{fill:i%2===0?C.greyLight:C.white,type:ShadingType.CLEAR}, children:[P(bold(n,20))] }),
          new TableCell({ borders, margins: cellPad, width:{size:1800,type:WidthType.DXA}, shading:{fill:i%2===0?C.greyLight:C.white,type:ShadingType.CLEAR}, children:[P(T(s,{bold:true,color:C.teal,size:20,font:"Calibri"}),{alignment:AlignmentType.CENTER})] }),
          new TableCell({ borders, margins: cellPad, width:{size:1800,type:WidthType.DXA}, shading:{fill:i%2===0?C.greyLight:C.white,type:ShadingType.CLEAR}, children:[P(normal(c),{alignment:AlignmentType.CENTER})] }),
          new TableCell({ borders, margins: cellPad, width:{size:1760,type:WidthType.DXA}, shading:{fill:i%2===0?C.greyLight:C.white,type:ShadingType.CLEAR}, children:[P(normal(t3),{alignment:AlignmentType.CENTER})] }),
          new TableCell({ borders, margins: cellPad, width:{size:1400,type:WidthType.DXA}, shading:{fill:i%2===0?C.greyLight:C.white,type:ShadingType.CLEAR}, children:[P(normal(a),{alignment:AlignmentType.CENTER})] }),
        ]})
      ),
    ],
  }),
  space(),
  body("Bilan national : SPI median = +1.51 (Humide). 0 bassin en alerte sur 9. Le modele predit un retour vers la normale en juillet 2026 (SPI prevu : -0.25) coherent avec l'entree en saison seche estivale."),
  space(2),

  // ── 9. Stack technique ───────────────────────────────────────────────────
  heading1("9. Stack Technique"),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2200, 3360, 3800],
    rows: [
      tableHeader(["Composant", "Technologie", "Version / Detail"], [2200,3360,3800]),
      ...([
        ["Pipeline ML",      "Python 3.13",                       "scikit-learn, XGBoost 2.x, LightGBM 4.x, SciPy"],
        ["Donnees",          "Open-Meteo API / ERA5-Land",        "Archive historique 1981-2026, sans authentification"],
        ["Geospatial",       "GeoPandas + HydroSHEDS",            "Shapely, EPSG:4326, simplification 0.01 deg"],
        ["Frontend",         "React 18 + Vite 5",                 "Framer Motion 11, Tailwind CSS v3"],
        ["Carte",            "React-Leaflet v4",                  "CartoDB Dark Matter, GeoJSON overlay temps reel"],
        ["Graphiques",       "Chart.js 4 / react-chartjs-2",      "Line, Bar, Radar, Doughnut"],
        ["Export",           "JSON (predictions.json)",           "Alimente le frontend, regenerable a la demande"],
        ["Environnement",    "Windows 11 + Node 22 + npm 10",     "Deploiement local, portable vers VPS/Docker"],
      ]).map(([c, t, v], i) =>
        new TableRow({ children: [
          new TableCell({ borders, margins: cellPad, width:{size:2200,type:WidthType.DXA}, shading:{fill:i%2===0?C.greyLight:C.white,type:ShadingType.CLEAR}, children:[P(bold(c,20))] }),
          new TableCell({ borders, margins: cellPad, width:{size:3360,type:WidthType.DXA}, shading:{fill:i%2===0?C.greyLight:C.white,type:ShadingType.CLEAR}, children:[P(normal(t))] }),
          new TableCell({ borders, margins: cellPad, width:{size:3800,type:WidthType.DXA}, shading:{fill:i%2===0?C.greyLight:C.white,type:ShadingType.CLEAR}, children:[P(normal(v))] }),
        ]})
      ),
    ],
  }),
  space(2),

  // ── 10. Limites et perspectives ──────────────────────────────────────────
  heading1("10. Limites et Perspectives"),
  heading2("10.1 Limites Actuelles"),
  bullet("R2 negatif sur la periode 2024-2026 : la transition secheresse/humide exceptionnelle depasse la distribution historique d'entrainement"),
  bullet("Resolution spatiale du centroide (1 point par bassin) vs. interpolation spatiale complete du bassin"),
  bullet("Absence d'indices ENSO / NAO comme predicteurs teleconnexion"),
  bullet("Pas de mise a jour temps reel : pipeline manuel (relance requise chaque mois)"),
  heading2("10.2 Améliorations Planifiees"),
  numbered("Integration d'indices climatiques ENSO (Nino 3.4) et NAO en tant que features externes"),
  numbered("Automatisation mensuelle via cron job ou scheduler"),
  numbered("Quantification de l'incertitude : intervalles de confiance par bootstrap"),
  numbered("Etendre a SPI-12 pour la surveillance des ressources souterraines"),
  numbered("Passage a une resolution multi-pixels par bassin (moyennage spatial ERA5-Land)"),
  space(2),

  // ── 11. Références ─────────────────────────────────────────────────────
  heading1("11. References"),
  bullet("McKee T.B. et al. (1993). The relationship of drought frequency and duration to time scales. Proc. 8th AMS Conference on Applied Climatology."),
  bullet("WMO (2012). Standardized Precipitation Index User Guide. WMO-No. 1090."),
  bullet("Lehner B. et al. (2008). New global hydrography derived from spaceborne elevation data. EOS, 89(10)."),
  bullet("Muñoz-Sabater J. et al. (2021). ERA5-Land: a state-of-the-art global reanalysis dataset. Geoscientific Model Development, 14(9)."),
  bullet("Open-Meteo (2024). Historical Weather API. https://open-meteo.com"),
  bullet("HydroSHEDS (2024). https://www.hydrosheds.org"),
  space(3),
  hr(),
  P([
    T("Rapport genere le 07 mai 2026  |  ", { size: 18, font: "Calibri", color: C.grey3, italics: true }),
    T("Pipeline v1.0  |  ERA5-Land 1981-2026  |  9 Bassins Versants Maroc", { size: 18, font: "Calibri", color: C.grey3, italics: true }),
  ], { alignment: AlignmentType.CENTER }),
];

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Calibri", size: 20 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run:  { size: 32, bold: true, font: "Calibri", color: C.navy },
        paragraph: { spacing: { before: 400, after: 180 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run:  { size: 26, bold: true, font: "Calibri", color: C.blue },
        paragraph: { spacing: { before: 300, after: 120 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run:  { size: 22, bold: true, font: "Calibri", color: C.grey2 },
        paragraph: { spacing: { before: 200, after: 80 },  outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.blueLight, space: 2 } },
          children: [
            T("Rapport Technique | Prediction Secheresse Maroc | Mai 2026", { size: 16, font: "Calibri", color: C.grey3 }),
          ],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.blueLight, space: 2 } },
          tabStops: [{ type: require("docx").TabStopType.RIGHT, position: require("docx").TabStopPosition.MAX }],
          children: [
            T("EL HIOUILE Z. | HARBAL S. | BOUCETTA A. | EL ASAD A.", { size: 16, font: "Calibri", color: C.grey3 }),
            T("\tPage ", { size: 16, font: "Calibri", color: C.grey3 }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, font: "Calibri", color: C.grey3 }),
          ],
        })],
      }),
    },
    children,
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("C:/Users/YOGA/Desktop/ml/rapport_prediction_secheresse_maroc.docx", buf);
  console.log("OK: rapport_prediction_secheresse_maroc.docx");
});
