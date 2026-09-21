const fs = require('fs');
const html = fs.readFileSync('about_portgrand.html', 'utf8');

const knownCategories = [
  'Accessibility', 'Service options', 'Highlights', 'Popular for', 
  'Offerings', 'Dining options', 'Amenities', 'Atmosphere', 
  'Crowd', 'Planning', 'Payments', 'Children', 'Parking'
];

for (const term of knownCategories) {
  const index = html.indexOf(term);
  if (index !== -1) {
    console.log(`\n--- Found ${term} ---`);
    const start = Math.max(0, index - 100);
    console.log(html.substring(start, index + term.length + 100));
  }
}
