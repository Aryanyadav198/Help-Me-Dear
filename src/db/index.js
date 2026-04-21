import mongoose from "mongoose";
import DB_NAME from "../constants.js";

const connectDb = async () => {
  try {
    const conn = await mongoose.connect(`${process.env.MONGODB_URI}${DB_NAME}`);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`❌ DB Error: ${err.message}`);
    throw err;
  }
};

export default connectDb;