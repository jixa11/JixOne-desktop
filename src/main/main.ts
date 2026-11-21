// Entry point: point the session store at the user's data folder before the
// engine modules read it, then start the app.
import { app } from 'electron';

process.env.JIXONE_DATA_DIR = app.getPath('userData');
require('./app');
