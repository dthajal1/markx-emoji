
import { getEnvVar } from "@collabland/common";
import mongoose from 'mongoose';

export async function dbConnect() {
    if (mongoose.connection.readyState >= 1) return;

    return mongoose.connect(getEnvVar('MONGODB_URI') || "", {
        // useNewUrlParser: true,
        // useUnifiedTopology: true,
        // dbName: 'ISeeIP', 
        dbName: 'testingtesting',
    });
}