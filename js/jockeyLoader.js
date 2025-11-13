// js/jockeyLoader.js
// Loads and parses the jockey_stats.txt file into a usable data array

async function loadJockeyStats() {
  try {
    const response = await fetch('jockey_stats.txt');
    const text = await response.text();

    // Split into lines, remove empty ones
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    // Skip the header row if it starts with #
    const dataLines = lines.filter(line => !line.startsWith('#'));

    const jockeys = dataLines.map(line => {
      const parts = line.split(',').map(p => p.trim());
      return {
        rank: parseInt(parts[0]),
        name: parts[1],
        starts: parseInt(parts[2].replace(/,/g, '')),
        wins: parseInt(parts[3].replace(/,/g, '')),
        places: parseInt(parts[4].replace(/,/g, '')),
        shows: parseInt(parts[5].replace(/,/g, '')),
        earnings: parts[6],
        winPct: parseFloat(parts[7].replace('%', '')),
        wpsPct: parseFloat(parts[8].replace('%', ''))
      };
    });

    console.log("✅ Jockey stats loaded:", jockeys.length, "entries");
    return jockeys;

  } catch (err) {
    console.error("❌ Error loading jockey stats:", err);
    return [];
  }
}

