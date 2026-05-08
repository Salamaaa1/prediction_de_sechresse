import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import joblib

def create_simulated_dataset(n_samples=5000):
    """
    Creates a simulated historical multimodal dataset mapping 
    meteorological and spectral features to Drought levels.
    """
    np.random.seed(42)
    
    # Simulate weather factors based on Moroccan climate profiles
    temperature_2m = np.random.uniform(10, 48, n_samples)
    relative_humidity_2m = np.random.uniform(10, 90, n_samples)
    wind_speed_10m = np.random.uniform(0, 30, n_samples)
    
    # Calculate Vapor Pressure Deficit (VPD)
    es = 0.6108 * np.exp((17.27 * temperature_2m) / (temperature_2m + 237.3))
    ea = es * (relative_humidity_2m / 100)
    vpd = es - ea
    
    # Simulate Static Feature (Elevation DEM in meters - e.g. Al Massira or Marrakech)
    elevation = np.random.uniform(100, 1500, n_samples)
    
    # Simulate Spectral Feature (NDVI) reacting inversely to VPD and heat
    base_ndvi = 0.8
    ndvi = base_ndvi - (vpd * 0.1) - (temperature_2m * 0.005) + np.random.normal(0, 0.05, n_samples)
    ndvi = np.clip(ndvi, 0, 1)
    
    df = pd.DataFrame({
        'temperature_2m': temperature_2m,
        'relative_humidity_2m': relative_humidity_2m,
        'wind_speed_10m': wind_speed_10m,
        'VPD': vpd,
        'elevation': elevation,
        'NDVI': ndvi
    })
    
    # Target Logic: What constitutes a Flash Drought?
    # High VPD + Low NDVI + High temperatures
    conditions = [
        (df['VPD'] > 3.0) | ((df['VPD'] > 2.5) & (df['NDVI'] < 0.3)),
        (df['VPD'] > 1.5) & (df['NDVI'] < 0.5),
    ]
    choices = ['High (Stress)', 'Moderate']
    df['Flash_Drought_Risk'] = np.select(conditions, choices, default='Low')
    
    return df

def train_and_save_model():
    print("Generating simulated historical dataset for Morocco...")
    df = create_simulated_dataset(10000)
    
    features = ['temperature_2m', 'relative_humidity_2m', 'wind_speed_10m', 'VPD', 'elevation', 'NDVI']
    X = df[features]
    y = df['Flash_Drought_Risk']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print("Training Random Forest Classifier on Multimodal Data...")
    clf = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
    clf.fit(X_train, y_train)
    
    y_pred = clf.predict(X_test)
    print("\nModel Accuracy:", accuracy_score(y_test, y_pred))
    print("\nClassification Report:\n", classification_report(y_test, y_pred))
    
    filename = 'drought_model.pkl'
    joblib.dump(clf, filename)
    print(f"Model saved gracefully to {filename}.")

if __name__ == "__main__":
    train_and_save_model()
