// GEE Script: Export LST, NDVI, NLCD Land Cover, Impervious Surface, and Tree Canopy for NYC
// Platform: Google Earth Engine Code Editor (https://code.earthengine.google.com)
// Data sources:
//   - Landsat 8 Collection 2 Level 2 (Surface Reflectance + Surface Temperature)
//   - NLCD 2019 (Land Cover & Impervious Surface)
//   - NLCD Tree Canopy (2016, latest available in GEE)
//
// Processing details:
//   - Study area: New York City boundary (user asset)
//   - Time period: Summer 2020 (June–August)
//   - Cloud filtering: Scenes with <20% cloud cover + QA-based masking (cloud, shadow, water)
//   - Outputs:
//       * Land Surface Temperature (LST, °C)
//       * NDVI
//       * Land Cover (NLCD 2019)
//       * Impervious Surface (%)
//       * Tree Canopy Cover (%)

// Load NYC boundary
var nyc = ee.FeatureCollection("projects/ee-gyang03/assets/nyc_boundary");
Map.centerObject(nyc, 10);
Map.addLayer(nyc, {color: "blue"}, "NYC Boundary");

// Load Landsat 8 Collection 2, Level 2 (surface reflectance + ST)
var landsat = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
  .filterBounds(nyc)
  .filterDate("2020-06-01", "2020-08-31")
  .filter(ee.Filter.lt("CLOUD_COVER", 20));  // keep low-cloud scenes only

// Cloud/water mask function
function maskClouds(image) {
  var qa = image.select("QA_PIXEL");
  var cloudFree = qa.bitwiseAnd(1 << 3).eq(0)  // cloud shadow
    .and(qa.bitwiseAnd(1 << 4).eq(0))           // cloud
    .and(qa.bitwiseAnd(1 << 7).eq(0));           // water
  return image.updateMask(cloudFree);
}

// Compute LST in Celsius
function computeLST(image) {
  var lst = image.select("ST_B10")
    .multiply(0.00341802)
    .add(149.0)
    .subtract(273.15)  // Kelvin to Celsius
    .rename("LST");
  return image.addBands(lst);
}

// Compute NDVI
function computeNDVI(image) {
  var ndvi = image.normalizedDifference(["SR_B5", "SR_B4"]).rename("NDVI");
  return image.addBands(ndvi);
}

// Apply functions
var processed = landsat
  .map(maskClouds)
  .map(computeLST)
  .map(computeNDVI);

// Median composite across summer scenes
var composite = processed.select(["LST", "NDVI"]).median().clip(nyc);

// Export LST
Export.image.toDrive({
  image: composite.select("LST"),
  description: "NYC_LST_Summer2020",
  folder: "UHI_Project",
  fileNamePrefix: "nyc_lst_2020",
  region: nyc.geometry(),
  scale: 30,
  crs: "EPSG:4326",
  maxPixels: 1e9
});

// Export NDVI
Export.image.toDrive({
  image: composite.select("NDVI"),
  description: "NYC_NDVI_Summer2020",
  folder: "UHI_Project",
  fileNamePrefix: "nyc_ndvi_2020",
  region: nyc.geometry(),
  scale: 30,
  crs: "EPSG:4326",
  maxPixels: 1e9
});

var nlcd = ee.Image("USGS/NLCD_RELEASES/2019_REL/NLCD/2019");

// Land Cover (for grass extraction)
var landCover = nlcd.select("landcover").clip(nyc);

// Fractional Impervious Surface (2019 in GEE, closest available)
var impervious = nlcd.select("impervious").clip(nyc);

// Tree Canopy Cover
var treeCanopy = ee.ImageCollection("USGS/NLCD_RELEASES/2016_REL")
  .filter(ee.Filter.eq("system:index", "2016"))
  .first()
  .select("percent_tree_cover")
  .clip(nyc);

// Export all three
Export.image.toDrive({
  image: treeCanopy,
  description: "NYC_TreeCanopy_2019",
  folder: "UHI_Project",
  fileNamePrefix: "nyc_tree_canopy_2019",
  region: nyc.geometry(),
  scale: 30,
  crs: "EPSG:4326",
  maxPixels: 1e9
});

Export.image.toDrive({
  image: landCover,
  description: "NYC_LandCover_2019",
  folder: "UHI_Project",
  fileNamePrefix: "nyc_landcover_2019",
  region: nyc.geometry(),
  scale: 30,
  crs: "EPSG:4326",
  maxPixels: 1e9
});

Export.image.toDrive({
  image: impervious,
  description: "NYC_Impervious_2019",
  folder: "UHI_Project",
  fileNamePrefix: "nyc_impervious_2019",
  region: nyc.geometry(),
  scale: 30,
  crs: "EPSG:4326",
  maxPixels: 1e9
});