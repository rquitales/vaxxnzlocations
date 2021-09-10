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
  data.features.forEach(f => {
    const geometry = f.geometry
    const coordinates = geometry.coordinates
    coordsToCheck.push(coordinates)
  })
  return coordsToCheck
}

async function main () {
  var extent = NZbbox
  var cellSide = 10;
  var options = {units: 'kilometers', mask: nz};

  const coordsToCheck = await getAllCoordsToCheck()

  save('startedLocationsScrapeAt.json', `"${new Date().toISOString()}"`)
  var grid = turf.pointGrid(extent, cellSide, options);
  for(var i = 0; i < coordsToCheck; i++) {
      const coords = coordsToCheck[i]
      await getLocations(coords[1], coords[0]);
      console.log(`${i}/${coordsToCheck}`)
  }
  save('uniqLocations.json', JSON.stringify(uniqLocations, null, 2))
  save('endedLocationsScrapeAt.json', `"${new Date().toISOString()}"`)
}
main()