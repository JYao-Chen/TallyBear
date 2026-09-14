import {startWorker} from '../src/server/job-worker';
startWorker().catch(error=>{console.error(error.message);process.exit(1);});
