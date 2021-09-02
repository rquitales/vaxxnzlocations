const fetch = require("node-fetch");
const uniqLocations = require("./uniqLocations.json");
const fs = require("fs");
require('dotenv').config()

function save(file, str) {
  fs.writeFileSync(file, str + "\n")
}

async function getSlots(location, availability) {
  console.log(`Getting slot for ${location.name} - ${availability.date}`);

  const res = await fetch(
    `${process.env.PROXY_URL}/public/locations/${location.extId}/date/${availability.date}/slots`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        vaccineData: "WyJhMVQ0YTAwMDAwMEhJS0NFQTQiXQ==",
        groupSize: 1,
        url: "https://app.bookmyvaccine.covid19.health.nz/appointment-select",
        timeZone: "Pacific/Auckland",
      }),
    }
  );
  const dataStr = await res.text();
  let data
  try {
    data = JSON.parse(dataStr)
  }
  catch (e) {
    console.log('Couldn\'t parse JSON. Response text below')
    console.log('res.status', res.status)
    console.log(dataStr)
    throw e
  }
  return data;
}

async function getAvailability(location) {
  const locationAvailability = require(`./availability/${location.extId}.json`)

  const startDateStr = new Date().toISOString().slice(0, 10);
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 2);
  const endDateStr = endDate.toISOString().slice(0, 10);

  console.log(
    `Getting availability for ${location.name} between ${startDateStr} and ${endDateStr}`
  );

  const res = await fetch(
    `${process.env.PROXY_URL}/public/locations/${location.extId}/availability`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: startDateStr,
        endDate: endDateStr,
        vaccineData: "WyJhMVQ0YTAwMDAwMEhJS0NFQTQiXQ==",
        groupSize: 1,
        doseNumber: 1,
        url: "https://app.bookmyvaccine.covid19.health.nz/appointment-select",
        timeZone: "Pacific/Auckland",
      }),
    }
  );
  const dataStr = await res.text();
  let data
  try {
    data = JSON.parse(dataStr)
  }
  catch (e) {
    console.log('Couldn\'t parse JSON. Response text below')
    console.log('res.status', res.status)
    console.log(dataStr)
    throw e
  }

  const slots = [];
  for (const availability of data.availability) {
    if (!locationAvailability[availability.date]) { // if we know this day has been previously booked out, skip
      // okay, this is not good actually. a slot might get unbooked.
      console.log('skipping previously booked out day')
      continue
    }
    if (!availability.available) {
      continue;
    }
    const slot = await getSlots(location, availability);
    slots.push(slot);
  }

  const output = {};
  for (const slot of slots) {
    output[slot.date] = slot.slotsWithAvailability;
  }

  fs.writeFileSync(
    `./availability/${location.extId}.json`,
    JSON.stringify({ availabilityDates: output, lastUpdatedAt: new Date() }, null, 2)
  );
}

async function main() {
  save('startedScrapeAt.json', `"${new Date().toISOString()}"`)
  console.log('started at', new Date())
  for (const location of uniqLocations) {
    await getAvailability(location);
  }
  console.log('ended at', new Date())
  save('endedScrapeAt.json', `"${new Date().toISOString()}"`)
}

main();
