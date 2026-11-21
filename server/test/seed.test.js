const {test}=require('node:test');
const assert=require('node:assert/strict');
const mongoose=require('mongoose');
const {seed}=require('../scripts/seed');
const User=require('../models/User');
const Service=require('../models/Service');
test('demo seed refuses unconfirmed or production databases before connecting',async t=>{
 const env={NODE_ENV:process.env.NODE_ENV,SEED_DATABASE_NAME:process.env.SEED_DATABASE_NAME,MONGO_URI:process.env.MONGO_URI};
 t.after(()=>{for(const [key,value] of Object.entries(env))if(value===undefined)delete process.env[key];else process.env[key]=value;});
 const connection=t.mock.method(mongoose,'connect',async()=>{});
 process.env.NODE_ENV='production';await assert.rejects(seed(),/requires NODE_ENV/);assert.equal(connection.mock.calls.length,0);
 process.env.NODE_ENV='development';process.env.MONGO_URI='mongodb://localhost:27017/real_business';process.env.SEED_DATABASE_NAME='real_business';await assert.rejects(seed(),/Refusing/);assert.equal(connection.mock.calls.length,0);
});
test('demo seed repeats 16 stable upserts, creates no reviews and never replaces existing fields',async t=>{
 const env={NODE_ENV:process.env.NODE_ENV,SEED_DATABASE_NAME:process.env.SEED_DATABASE_NAME,MONGO_URI:process.env.MONGO_URI};const descriptor=Object.getOwnPropertyDescriptor(mongoose.connection,'name');
 t.after(()=>{for(const [key,value] of Object.entries(env))if(value===undefined)delete process.env[key];else process.env[key]=value;if(descriptor)Object.defineProperty(mongoose.connection,'name',descriptor);else delete mongoose.connection.name;});
 process.env.NODE_ENV='development';process.env.MONGO_URI='mongodb://localhost:27017/localtrust_demo';process.env.SEED_DATABASE_NAME='localtrust_demo';Object.defineProperty(mongoose.connection,'name',{value:'localtrust_demo',configurable:true});
 t.mock.method(mongoose,'connect',async()=>{});t.mock.method(Service,'init',async()=>{});t.mock.method(User,'findOne',async({email})=>({_id:email,role:'provider',demo:true}));
 const update=t.mock.method(Service,'updateOne',async()=>({upsertedCount:1}));
 await seed();await seed();assert.equal(update.mock.calls.length,32);
 assert.deepEqual(update.mock.calls.slice(0,16).map(call=>call.arguments[0]),update.mock.calls.slice(16).map(call=>call.arguments[0]));
 for(const call of update.mock.calls){const [filter,change,options]=call.arguments;assert.ok(filter.demoKey);assert.deepEqual(Object.keys(change),['$setOnInsert']);assert.equal(change.$setOnInsert.demo,true);assert.equal(change.$setOnInsert.coordinates.type,'Point');assert.equal(options.upsert,true);assert.match(change.$setOnInsert.description,/fictional/i);assert.equal('review' in change.$setOnInsert,false);}
});
