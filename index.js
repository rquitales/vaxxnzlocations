const fetch = require("node-fetch");
const turf = require("@turf/turf");
const nz = require('./nz.json')
const fs = require('fs')
const {format} = require('date-fns')
const NZbbox = [166.509144322, -46.641235447, 178.517093541, -34.4506617165];
require('dotenv').config()

function save(file, str) {
  fs.writeFileSync(file, str + "\n")
}



const locationIds = new Set([])

const uniqLocations = []

async function getLocations(lat, lng, cursor) {
  const res = await fetch(
    `${process.env.PROXY_URL}/public/locations/search`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        location: { lat, lng },
        fromDate: format(new Date(), 'yyyy-MM-dd'),
        vaccineData: "WyJhMVQ0YTAwMDAwMEhJS0NFQTQiXQ==",
        locationQuery: {
          includePools: ["default"],
          includeTags: [],
          excludeTags: [],
        },
        doseNumber: 1,
        groupSize: 1,
        limit: 10000,
        cursor: cursor,
        locationType: "CombinedBooking",
        filterTags: [],
        url: "https://app.bookmyvaccine.covid19.health.nz/location-select",
        timeZone: "Pacific/Auckland",
      }),
    }
  );
  const data = await res.json();
  const newCursor = data.cursor;
  if (newCursor) {
    const rest = await getLocations(lat, lng, newCursor);
    for (let i = 0; i < data.locations.length; i++) {
      const location = data.locations[i];
      if (!locationIds.has(location.extId)) {
        locationIds.add(location.extId)
        uniqLocations.push(location);      
      }
    }
    return [...data.locations, ...rest];
  }
  else {
    return data.locations
  }
}

const getAllCoordsToCheck = async () => {
  const res = await fetch("https://maps.bookmyvaccine.covid19.health.nz/booking_site_availability.json")
  const data = await res.json()
  const coordsToCheck = []
  // const
  // data.features.forEach(f => {
  //   const geometry = f.geometry
  //   const coordinates = geometry.coordinates
  //   coordsToCheck.push(coordinates)
  // })
  return data
}

async function main () {
  // var extent = NZbbox
  // var cellSide = 10;
  // var options = {units: 'kilometers', mask: nz};

  var points = turf.randomPoint(100, {bbox: [0, 30, 20, 50]});
  console.log('points', points.features.length)

  const data = await getAllCoordsToCheck()
  console.log('data', data.features.length)

  var maxDistance = 30;
  var clustered = turf.clustersDbscan(data, maxDistance, {units: "kilometers"});
  // console.log('corePoints', clustered.features)

  let initialValue = 0
  const clusterFeatures = []
  turf.clusterReduce(clustered, 'cluster', function (previousValue, cluster, clusterValue, currentIndex) {
    clusterFeatures.push(cluster.features[0])
    console.log('cluster',cluster.features[0].geometry.coordinates)
    //=previousValue
    //=cluster
    //=clusterValue
    //=currentIndex
    return previousValue++;
  }, initialValue);
  console.log('initialValue',initialValue)


  // console.log('clustered', clustered.features.map(f => f.geometry.coordinates))
  const otherFeatures = clustered.features.filter(f => f.properties.dbscan === "noise")
  console.log('otherPoints', otherFeatures.length)

  // console.log('coordsToCheck',coordsToCheck)

  save('startedLocationsScrapeAt.json', `"${new Date().toISOString()}"`)
  // var grid = turf.pointGrid(extent, cellSide, options);
  const featuresToCheck = [...clusterFeatures, ...otherFeatures]
  for(var i = 0; i < featuresToCheck.length; i++) {
      const coords = featuresToCheck[i].geometry.coordinates

      // const coords = clustered[i]
      // console.log('coords',coords)
      await getLocations(coords[1], coords[0]);
      console.log(`${i}/${featuresToCheck.length}`)
  }
  save('uniqLocations.json', JSON.stringify(uniqLocations, null, 2))
  save('endedLocationsScrapeAt.json', `"${new Date().toISOString()}"`)
}
main()