import express from "express";
import cors from "cors"
import cookieParser from "cookie-parser";

const app = express();

app.use(express.json({limit: "16kb"}));
app.use(express.urlencoded({extended: true, limit: "16kb"}));
app.use(express.static("public"));
app.use(cookieParser());
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));

//import routes
import { router } from "./routes/user.routes.js";

//user route 
app.use("/api/v1/users",router);

export {app}