import pandas as pd
import numpy as np
import requests

def fetch_weather_data(lat, lon, days=14):
    """
    Fetches real hourly weather data from Open-Meteo for the past 'days' days.
    Required variables: temperature_2m, relative_humidity_2m, wind_speed_10m.
    """
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "past_days": days,
        "hourly": "temperature_2m,relative_humidity_2m,wind_speed_10m",
        "timezone": "auto" 
    }
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error fetching data: {e}")
        return None

def process_weather_features(data):
    """
    Processes raw Open-Meteo hourly JSON into a pandas DataFrame and calculates
    Evapotranspiration metrics like Vapor Pressure Deficit (VPD).
    """
    if data is None or 'hourly' not in data:
        return pd.DataFrame()
        
    df = pd.DataFrame(data['hourly'])
    df['time'] = pd.to_datetime(df['time'])
    
    # Clean possible missing values
    df = df.dropna(subset=['temperature_2m', 'relative_humidity_2m'])
    
    # Calculate Vapor Pressure Deficit (VPD) - a key drought indicator
    df['temp_c'] = df['temperature_2m']
    # Saturation vapor pressure (es) in kPa
    es = 0.6108 * np.exp((17.27 * df['temp_c']) / (df['temp_c'] + 237.3))
    # Actual vapor pressure (ea)
    ea = es * (df['relative_humidity_2m'] / 100)
    # Vapor Pressure Deficit
    df['VPD'] = es - ea
    
    # Simulated Data for inference pipeline
    # Elevation: mock around 500m
    df['elevation'] = 500.0
    
    # Simulated NDVI just for intersection mapping
    np.random.seed(42)
    # Simulate NDVI inversely correlated with VPD
    base_ndvi = 0.6 
    df['simulated_NDVI'] = base_ndvi - (df['VPD'] * 0.1) + np.random.normal(0, 0.05, len(df))
    df['simulated_NDVI'] = df['simulated_NDVI'].clip(0, 1)

    # Machine Learning Inference replacing static algorithm
    import os
    import joblib
    model_path = 'drought_model.pkl'
    if os.path.exists(model_path):
        try:
            model = joblib.load(model_path)
            inference_features = df[['temperature_2m', 'relative_humidity_2m', 'wind_speed_10m', 'VPD', 'elevation', 'simulated_NDVI']].rename(columns={'simulated_NDVI': 'NDVI'})
            # Make predictive inferencing
            df['Flash_Drought_Risk'] = model.predict(inference_features)
        except Exception as e:
            print("Error loading or predicting with ML model:", e)
            df['Flash_Drought_Risk'] = np.where(df['VPD'] > 2.5, 'High (Stress)', np.where(df['VPD'] > 1.5, 'Moderate', 'Low'))
    else:
        df['Flash_Drought_Risk'] = np.where(df['VPD'] > 2.5, 'High (Stress)', np.where(df['VPD'] > 1.5, 'Moderate', 'Low'))

    # Ensure columns match for app
    if 'NDVI' not in df.columns:
        df['NDVI'] = df['simulated_NDVI']

    return df

def get_daily_summary(df):
    if df.empty:
        return pd.DataFrame()
        
    daily = df.copy()
    daily['date'] = daily['time'].dt.date
    summary = daily.groupby('date').agg({
        'temperature_2m': 'mean',
        'relative_humidity_2m': 'mean',
        'wind_speed_10m': 'mean',
        'VPD': 'max', # Max daily VPD is critical for stress
        'simulated_NDVI': 'mean'
    }).reset_index()
    return summary
