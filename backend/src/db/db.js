import mongoose, { mongo } from "mongoose";
import dotenv from "dotenv";
dotenv.config({})

const mongo_uri = process.env.MONGO_URI;


export const connectMongo = async() => {
    try {
       await mongoose.connect(mongo_uri);
       console.log("db is connected")
    } catch (error) {
        console.log(`error come from db : ${error}`);
        process.exit(1)
    }
}