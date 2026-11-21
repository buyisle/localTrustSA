// Additive development fixtures. No bookings, reviews, payments or verified claims.
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const crypto = require('node:crypto');
const User = require('../models/User');
const Service = require('../models/Service');
const { categories } = require('../lib/validation');
const areas = [
 ['Johannesburg',28.0473,-26.2041], ['Kempton Park',28.2376,-26.1001], ['Benoni',28.3698,-26.1885], ['Boksburg',28.2596,-26.2120],
 ['Midrand',28.1263,-25.9992], ['Pretoria',28.2293,-25.7479], ['Randburg',28.0000,-26.0936], ['Sandton',28.0573,-26.1076]
];
const names = ['Naledi Mokoena','Sipho Dlamini','Zanele Khumalo','Themba Nkosi','Lerato Molefe','Kabelo Ndlovu','Ayanda Maseko','Bongani Sithole','Refilwe Mahlangu','Sibusiso Zulu','Nomsa Mthembu','Thabo Modise','Palesa Radebe','Mandla Buthelezi','Dineo Mokoena','Tshepo Mokoena'];
const titles = ['Leak detection and tap repairs','Household electrical fault assessment','Regular home cleaning','Deep house cleaning','Interior room painting','Lawn care and garden tidy-up','At-home beauty appointment','Hair wash and styling','Cupboard and timber repairs','Washing machine assessment','Air conditioner servicing','Home maintenance visit','Household pest assessment','Kitchen and bathroom tiling','Local furniture moving','Exterior car wash'];
const prices = [450,650,350,650,1200,400,350,280,750,550,850,400,700,1800,1500,150];
const descriptions = [
  'Trace visible leaks, inspect worn seals and tackle straightforward tap repairs.',
  'Diagnose tripping breakers, faulty outlets and lighting issues in the home.',
  'Tidy living spaces, wipe surfaces and clean floors on a regular schedule.',
  'Focus on kitchens and bathrooms, with extra attention to buildup and hard-to-reach surfaces.',
  'Prepare minor wall imperfections and apply a clean finish to an interior room.',
  'Mow lawns, trim edges and clear cuttings from a small residential garden.',
  'Arrange a mobile manicure and nail tidy-up in the comfort of your home.',
  'Book a wash, blow-dry and styling appointment for an everyday or occasion look.',
  'Adjust cupboard doors, refit loose hinges and assess minor timber damage.',
  'Check drainage, unusual noises and faults on a household washing machine.',
  'Clean accessible filters and check the operation of a wall-mounted air conditioner.',
  'Get help with small household jobs such as fitting shelves and tightening hardware.',
  'Identify likely pest entry points and discuss treatment options for the property.',
  'Assess a small backsplash or bathroom tiling job and discuss suitable finishes.',
  'Arrange local transport for a small load of boxed items or freestanding furniture.',
  'Hand-wash the exterior, rinse wheels and dry the vehicle with microfibre cloths.'
];
async function seed() {
 if (process.env.NODE_ENV !== 'development' || !process.env.SEED_DATABASE_NAME || !process.env.MONGO_URI) throw Error('Seeding requires NODE_ENV=development, MONGO_URI, and SEED_DATABASE_NAME matching the development database.');
 const uriPath = new URL(process.env.MONGO_URI).pathname.slice(1);
 if (uriPath !== process.env.SEED_DATABASE_NAME || !/(dev|test|demo|local)/i.test(uriPath)) throw Error('Refusing to seed: confirm a named development/test/demo/local database.');
 await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
 if (mongoose.connection.name !== process.env.SEED_DATABASE_NAME) throw Error('Connected database differs from confirmed database.');
 await Service.init();
 for (let i=0; i<categories.length; i++) {
   const email=`provider-${i+1}@demo.localtrust.test`;
   let provider=await User.findOne({ email });
   if (!provider) provider=await User.create({ name: `${names[i]} (DEMO)`, email, role:'provider', password:crypto.randomBytes(32).toString('hex'), demo:true, verified:false, location:areas[i%areas.length][0], availability:{ days:i%2 ? [1,2,3,4,5] : [2,3,4,5,6], startHour:8+i%2, endHour:17 } });
   if (!provider.demo || provider.role !== 'provider') throw Error('Demo account collision; no existing account was changed.');
   const area = areas[i % areas.length];
   const demoKey = 'localtrust-demo-v2-' + i + '-0';
   await Service.updateOne({ demoKey }, {
     $setOnInsert: {
       demoKey, demo: true, provider: provider._id, category: categories[i],
       title: titles[i], description: 'Demo listing from a fictional provider. ' + descriptions[i],
       price: prices[i], location: area[0], active: true,
       coordinates: { type: 'Point', coordinates: [area[1], area[2]] }
     }
   }, { upsert: true, runValidators: true });
 }
 console.log('16 clearly labelled DEMO services prepared. Existing records preserved. Random demo passwords are not printed or stored in documentation.');
}
if (require.main === module) seed().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>mongoose.disconnect());
module.exports={seed};
