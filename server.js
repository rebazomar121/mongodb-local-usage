const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const archiver = require('archiver');
const dotenv = require('dotenv');
dotenv.config();


const app = express();
const PORT = process.env.PORT || 1532;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// MongoDB connection details
const CONTAINER_NAME = 'mongodb';
const DATA_DIR = './data';

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper function to execute shell commands
function executeCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject({ error, stderr });
            } else {
                resolve(stdout);
            }
        });
    });
}

// Get list of databases
app.get('/databases', async (req, res) => {
    try {
        const command = `docker exec ${CONTAINER_NAME} mongosh --quiet --eval "db.adminCommand('listDatabases').databases.map(d => d.name).join('\\n')"`;
        const output = await executeCommand(command);

        const databases = output
            .split('\n')
            .map(db => db.trim())
            .filter(db => db && db !== 'admin' && db !== 'config' && db !== 'local');

        res.json({
            success: true,
            databases: databases
        });
    } catch (error) {
        console.error('Error listing databases:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to list databases',
            error: error.stderr || error.message
        });
    }
});

// Dump/Backup database
app.post('/dump', async (req, res) => {
    const { database } = req.body;

    if (!database) {
        return res.status(400).json({
            success: false,
            message: 'Database name is required'
        });
    }

    try {
        // Run the dump command
        const dumpCommand = `./mongodb-backup.sh -d -n ${database}`;
        await executeCommand(dumpCommand);

        // Create zip file
        const zipFileName = `${database}_backup_${Date.now()}.zip`;
        const zipFilePath = path.join(__dirname, 'downloads', zipFileName);
        const databasePath = path.join(__dirname, DATA_DIR, database);

        // Ensure downloads directory exists
        if (!fs.existsSync(path.join(__dirname, 'downloads'))) {
            fs.mkdirSync(path.join(__dirname, 'downloads'), { recursive: true });
        }

        // Create zip archive
        const output = fs.createWriteStream(zipFilePath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            res.json({
                success: true,
                message: `Database "${database}" backed up successfully`,
                path: `${DATA_DIR}/${database}`,
                downloadUrl: `/download/${zipFileName}`
            });
        });

        archive.on('error', (err) => {
            throw err;
        });

        archive.pipe(output);
        archive.directory(databasePath, database);
        archive.finalize();

    } catch (error) {
        console.error('Error dumping database:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to backup database',
            error: error.stderr || error.message
        });
    }
});

// Download backup file
app.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'downloads', filename);

    if (fs.existsSync(filePath)) {
        res.download(filePath, filename, (err) => {
            if (err) {
                console.error('Error downloading file:', err);
            }
            // Optional: delete file after download
            setTimeout(() => {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }, 5000);
        });
    } else {
        res.status(404).json({
            success: false,
            message: 'File not found'
        });
    }
});

// Restore database
app.post('/restore', upload.array('files'), async (req, res) => {
    const { database } = req.body;
    const files = req.files;

    if (!database) {
        return res.status(400).json({
            success: false,
            message: 'Database name is required'
        });
    }

    if (!files || files.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Backup files are required'
        });
    }

    try {
        // Create restore directory
        const restoreDir = path.join(__dirname, DATA_DIR, database);
        if (!fs.existsSync(restoreDir)) {
            fs.mkdirSync(restoreDir, { recursive: true });
        }

        // Move uploaded files to restore directory
        for (const file of files) {
            const originalName = req.body[`filename_${file.fieldname}`] || file.originalname;
            const fileName = path.basename(originalName);
            const destPath = path.join(restoreDir, fileName);

            fs.renameSync(file.path, destPath);
        }

        // Run the restore command
        const restoreCommand = `./mongodb-backup.sh -r -n ${database}`;
        await executeCommand(restoreCommand);

        res.json({
            success: true,
            message: `Database "${database}" restored successfully`
        });

        // Cleanup uploaded files
        setTimeout(() => {
            if (fs.existsSync(restoreDir)) {
                // Don't delete the restore directory as it might be needed
            }
        }, 1000);

    } catch (error) {
        console.error('Error restoring database:', error);

        // Cleanup on error
        if (req.files) {
            req.files.forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to restore database',
            error: error.stderr || error.message
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'MongoDB Backup Server is running' });
});

// Start server
app.listen(PORT, () => {
    console.log(`MongoDB Backup Server running on http://localhost:${PORT}`);
    console.log(`Open http://localhost:${PORT}/index.html in your browser`);
});
