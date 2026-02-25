import dash
from dash import dcc, html, Input, Output
import plotly.express as px
import geopandas as gpd
import pandas as pd
import pygris


# Load data (cached)
def load_data():
    df = pd.read_csv("EJSCREEN_2023_Tracts_StatePct_with_AS_CNMI_GU_VI.csv")
    # Download census tract geometries (2020 Census)
    # pygris downloads directly from Census Bureau
    tracts = pygris.tracts(year=2020, cb=True)  # cb=True for simplified boundaries

    tracts[["GEOID"]] = tracts[["GEOID"]].apply(pd.to_numeric)

    # Merge EJSCREEN data with geometries
    # The 'ID' column in EJSCREEN is the FIPS code (GEOID in census data)
    gdf = tracts.merge(df, left_on="GEOID", right_on="ID", how="inner")

    return gdf


gdf = load_data()

import dash
from dash import dcc, html, Input, Output
import plotly.express as px
import geopandas as gpd

app = dash.Dash(__name__)

gdf = load_data()  # Your data loading function

app.layout = html.Div(
    [
        html.H1("EJSCREEN Explorer"),
        dcc.Dropdown(
            id="state-dropdown",
            options=[{"label": s, "value": s} for s in gdf["ST_ABBREV"].unique()],
            value=["IN"],
            multi=True,
        ),
        dcc.Dropdown(
            id="indicator-dropdown",
            options=[
                {"label": "PM 2.5", "value": "P_PM25"},
                {"label": "Ozone", "value": "P_OZONE"},
                {"label": "Cancer Risk", "value": "P_CANCER"},
            ],
            value="P_PM25",
        ),
        dcc.Graph(id="map"),
    ]
)


@app.callback(
    Output("map", "figure"),
    [Input("state-dropdown", "value"), Input("indicator-dropdown", "value")],
)
def update_map(selected_states, indicator):
    filtered = gdf[gdf["ST_ABBREV"].isin(selected_states)]

    fig = px.choropleth_mapbox(
        filtered,
        geojson=filtered.geometry,
        locations=filtered.index,
        color=indicator,
        hover_data=["CNTY_NAME", "P_PM25", "P_CANCER"],
        mapbox_style="carto-positron",
        zoom=5,
    )
    return fig


if __name__ == "__main__":
    app.run(debug=True)
