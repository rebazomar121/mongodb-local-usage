# MongoDB Local Development Setup

A complete MongoDB development environment with Docker Compose, featuring replica set configuration and easy backup/restore functionality.

## Features

- MongoDB latest version running in Docker
- Replica set configuration (rs0)
- Persistent data storage with Docker volumes
- Easy backup and restore script
- No authentication required for local development

## Prerequisites

- Docker installed and running
- Docker Compose installed

## Quick Start

### 1. Start MongoDB

```bash
docker-compose up -d
```

This will:
- Pull the MongoDB image (if not already downloaded)
- Create persistent volumes for data and configuration
- Start MongoDB with replica set enabled
- Initialize the replica set automatically

### 2. Verify MongoDB is Running

```bash
docker ps
```

You should see the `mongodb` container running on port 27017.

### 3. Check Replica Set Status

```bash
docker exec mongodb mongosh --eval "rs.status()"
```

## Configuration

### Docker Compose Setup

The `docker-compose.yml` file configures:

- **Image**: `mongo:latest`
- **Container Name**: `mongodb`
- **Port**: `27017:27017`
- **Replica Set**: `rs0`
- **Volumes**:
  - `mongodb_data` - stores database files
  - `mongodb_config` - stores configuration files
- **Restart Policy**: `unless-stopped`

### Replica Set

The replica set is automatically initialized on first run. Your data and replica set configuration persist across container restarts thanks to Docker volumes.

## Connecting to MongoDB

### Using MongoDB Shell (mongosh)

```bash
# Connect to MongoDB shell
docker exec -it mongodb mongosh

# Connect to specific database
docker exec -it mongodb mongosh myDatabase
```

### Connection String

For applications, use:
```
mongodb://localhost:27017/?replicaSet=rs0
```

## Backup and Restore

Use the `mongodb-backup.sh` script for easy backup and restore operations. All backups are stored in the `./data` folder.

### Backup Commands

**Backup all databases:**
```bash
./mongodb-backup.sh -d
```

**Backup a specific database:**
```bash
./mongodb-backup.sh -d -n mydatabase
```

### Restore Commands

**Restore all databases:**
```bash
./mongodb-backup.sh -r
```

**Restore a specific database:**
```bash
./mongodb-backup.sh -r -n mydatabase
```

### Script Flags

- `-d` : Dump (backup) operation
- `-r` : Restore operation
- `-n <database_name>` : Specify database name (optional)

## Common Commands

### Container Management

```bash
# Start MongoDB
docker-compose up -d

# Stop MongoDB
docker-compose down

# View logs
docker logs mongodb

# Follow logs in real-time
docker logs -f mongodb

# Restart MongoDB
docker-compose restart
```

### Database Operations

```bash
# List all databases
docker exec mongodb mongosh --eval "show dbs"

# Connect to MongoDB shell
docker exec -it mongodb mongosh

# Run a command
docker exec mongodb mongosh --eval "db.version()"
```

### Volume Management

```bash
# List volumes
docker volume ls

# Inspect data volume
docker volume inspect mongodb_mongodb_data

# See volume location
docker volume inspect mongodb_mongodb_data -f '{{.Mountpoint}}'
```

## Data Persistence

Your data is persistent thanks to Docker volumes:

- **mongodb_data**: Stores all database files
- **mongodb_config**: Stores configuration files

Even if you remove the container with `docker-compose down`, your data remains safe in the volumes. To completely remove data, use:

```bash
# WARNING: This deletes all data permanently
docker-compose down -v
```

## Replica Set Information

- **Replica Set Name**: rs0
- **Members**: Single node (localhost:27017)
- **Status**: PRIMARY

The replica set configuration persists across restarts and is stored in the data volume.

## File Structure

```
.
├── docker-compose.yml       # Docker Compose configuration
├── mongodb-backup.sh        # Backup/restore script
├── data/                    # Backup storage directory
│   └── <database_name>/     # Individual database backups
└── README.md               # This file
```

## Troubleshooting

### Container won't start

Check logs:
```bash
docker logs mongodb
```

### Connection refused

Ensure container is running:
```bash
docker ps
```

Check if port 27017 is available:
```bash
lsof -i :27017
```

### Replica set not initialized

Verify replica set status:
```bash
docker exec mongodb mongosh --eval "rs.status()"
```

If needed, manually initialize:
```bash
docker exec mongodb mongosh --eval "rs.initiate({_id: 'rs0', members: [{_id: 0, host: 'localhost:27017'}]})"
```

### Out of disk space

Check volume size:
```bash
docker system df -v
```

Clean up unused Docker resources:
```bash
docker system prune
```

## Notes

- This setup is intended for local development only
- No authentication is configured (not recommended for production)
- Replica set uses a single node (for multi-node setup, modify docker-compose.yml)
- Backup files are stored locally in the `./data` directory

## License

Free to use for local development.
