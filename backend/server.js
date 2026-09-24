import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import { connectMongo } from "./src/db/db.js";

dotenv.config({})
const app = express();


app.use(helmet());
app.use(cors({
    origin : "*"
}));
app.use(express.json({limit : '1mb'}));
app.use(express.urlencoded({extended : true}));

const port = process.env.PORT;

app.listen(port,() => {
    console.log(`app is running on port ${port}`)
})

app.get("/",(req,res)=>{
    res.status(200).json({msg:"backend server is up and working"})
})

connectMongo();
