import streamlit as st
import pandas as pd
import plotly.express as px
from weather_data import fetch_weather_data, process_weather_features, get_daily_summary

st.set_page_config(page_title="Flash Drought Monitor Morocco", layout="wide")

st.title("🌱 Moroccan Flash Drought Monitor")
st.markdown("Integrate Meteorological Data & NDVI to detect real-time plant stress in Moroccan regions.")

# Pre-defined regions
regions = {
    "Al Massira Dam / Settat": {"lat": 32.7667, "lon": -7.7000},
    "Marrakech-Safi (Olive Groves)": {"lat": 31.6300, "lon": -8.0089},
    "Souss-Massa (Agadir)": {"lat": 30.4202, "lon": -9.5982},
    "Saïss Plain (Fes-Meknes)": {"lat": 33.9167, "lon": -5.3333}
}

col1, col2 = st.columns([1, 3])

with col1:
    st.subheader("Region Selection")
    selected_region = st.selectbox("Select a target region:", list(regions.keys()))
    coords = regions[selected_region]
    
    st.write(f"**Coordinates:** {coords['lat']}°N, {coords['lon']}°W")
    
    st.markdown("### Why VPD?")
    st.info("Vapor Pressure Deficit (VPD) indicates how efficiently plants can transpire. High temperatures mixed with low humidity push VPD higher, driving water loss and triggering flash droughts even when vegetation appears green.")

with col2:
    with st.spinner("Fetching meteorological data from Open-Meteo..."):
        raw_data = fetch_weather_data(coords['lat'], coords['lon'], days=14)
        
    if raw_data:
        df_hourly = process_weather_features(raw_data)
        df_daily = get_daily_summary(df_hourly)
        
        # Determine Current Status
        latest_max_vpd = df_daily['VPD'].iloc[-1]
        
        if latest_max_vpd > 2.5:
            st.error(f"🚨 CRITICAL FLASH DROUGHT WARNING: Extremely high VPD ({latest_max_vpd:.2f} kPa) detected. Severe plant stress likely.")
        elif latest_max_vpd > 1.5:
            st.warning(f"⚠️ MODERATE STRESS: Elevated VPD ({latest_max_vpd:.2f} kPa). Plants are transpiring quickly.")
        else:
            st.success(f"✅ NORMAL CONDITIONS: VPD is stable at {latest_max_vpd:.2f} kPa.")

        # Plotly VPD Graph
        st.subheader("Vapor Pressure Deficit (VPD) Analysis")
        
        fig = px.line(df_hourly, x='time', y='VPD', title='Hourly VPD (kPa)', 
                      color_discrete_sequence=['red'])
        
        # Add stress threshold
        fig.add_hline(y=2.5, line_dash="dot", annotation_text="Critical Stress Threshold", annotation_position="top left", line_color="black")
        
        st.plotly_chart(fig, use_container_width=True)
        
        # Expanders for raw data
        with st.expander("Show Daily Summaries (NDVI & Evapotranspiration metrics)", expanded=True):
            st.dataframe(df_daily.style.background_gradient(subset=['VPD'], cmap='Reds'))
            
        with st.expander("Show Spectral Correlation (Simulated NDVI vs Moisture)"):
            import statsmodels.api as sm  # Needed for OLS trendline in plotly if used, but let's just make it without OLS if not installed
            try:
                fig2 = px.scatter(df_hourly, x='VPD', y='simulated_NDVI', color='Flash_Drought_Risk', 
                                  title="NDVI Dropping as VPD Climbs (Inverse Correlation)", 
                                  trendline="ols")
                st.plotly_chart(fig2, use_container_width=True)
            except Exception:
                fig2 = px.scatter(df_hourly, x='VPD', y='simulated_NDVI', color='Flash_Drought_Risk', 
                                  title="NDVI Dropping as VPD Climbs (Inverse Correlation)")
                st.plotly_chart(fig2, use_container_width=True)
            
    else:
        st.error("Failed to fetch data from Open-Meteo API. Please check your connection.")
