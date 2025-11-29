#!/bin/bash

# MongoDB Backup Script
# Usage:
#   ./mongodb-backup.sh -d              # Dump all databases to ./data
#   ./mongodb-backup.sh -d -n mydb      # Dump specific database to ./data
#   ./mongodb-backup.sh -r              # Restore all databases from ./data
#   ./mongodb-backup.sh -r -n mydb      # Restore specific database from ./data

DUMP_DIR="./data"
CONTAINER_NAME="mongodb"
DATABASE_NAME=""
ACTION=""

# Parse command line arguments
while getopts "drn:" opt; do
  case $opt in
    d)
      ACTION="dump"
      ;;
    r)
      ACTION="restore"
      ;;
    n)
      DATABASE_NAME="$OPTARG"
      ;;
    \?)
      echo "Invalid option: -$OPTARG" >&2
      echo "Usage: $0 -d|-r [-n database_name]"
      echo "  -d: Dump database(s)"
      echo "  -r: Restore database(s)"
      echo "  -n: Specify database name (optional, dumps/restores all if not specified)"
      exit 1
      ;;
  esac
done

# Check if action is specified
if [ -z "$ACTION" ]; then
    echo "Error: Please specify an action (-d for dump or -r for restore)"
    echo "Usage: $0 -d|-r [-n database_name]"
    exit 1
fi

# Create data directory if it doesn't exist
mkdir -p "$DUMP_DIR"

# DUMP operation
if [ "$ACTION" == "dump" ]; then
    echo "========================================="
    echo "Starting MongoDB DUMP..."
    echo "========================================="

    if [ -z "$DATABASE_NAME" ]; then
        echo "Dumping ALL databases to: $DUMP_DIR"

        # Dump all databases
        docker exec $CONTAINER_NAME mongodump --out=/tmp/mongodump

        # Copy dump from container to host
        docker cp $CONTAINER_NAME:/tmp/mongodump/. "$DUMP_DIR/"
    else
        echo "Dumping database '$DATABASE_NAME' to: $DUMP_DIR"

        # Dump specific database
        docker exec $CONTAINER_NAME mongodump --db=$DATABASE_NAME --out=/tmp/mongodump

        # Copy dump from container to host
        docker cp $CONTAINER_NAME:/tmp/mongodump/. "$DUMP_DIR/"
    fi

    # Clean up dump inside container
    docker exec $CONTAINER_NAME rm -rf /tmp/mongodump

    echo "========================================="
    echo "Dump completed successfully!"
    echo "Data saved to: $DUMP_DIR"
    echo "========================================="
fi

# RESTORE operation
if [ "$ACTION" == "restore" ]; then
    echo "========================================="
    echo "Starting MongoDB RESTORE..."
    echo "========================================="

    # Check if data directory exists
    if [ ! -d "$DUMP_DIR" ]; then
        echo "Error: Directory '$DUMP_DIR' does not exist!"
        echo "Please run dump first or create the data directory."
        exit 1
    fi

    # Check if data directory is empty
    if [ -z "$(ls -A $DUMP_DIR)" ]; then
        echo "Error: Directory '$DUMP_DIR' is empty!"
        echo "Please add MongoDB dump files to restore."
        exit 1
    fi

    # Create restore directory in container
    docker exec $CONTAINER_NAME mkdir -p /tmp/mongorestore

    if [ -z "$DATABASE_NAME" ]; then
        echo "Restoring ALL databases from: $DUMP_DIR"

        # Copy dump files to container
        docker cp "$DUMP_DIR/." $CONTAINER_NAME:/tmp/mongorestore/

        # Restore all databases
        docker exec $CONTAINER_NAME mongorestore /tmp/mongorestore/
    else
        echo "Restoring database '$DATABASE_NAME' from: $DUMP_DIR/$DATABASE_NAME"

        # Check if database dump exists
        if [ ! -d "$DUMP_DIR/$DATABASE_NAME" ]; then
            echo "Error: Database dump '$DUMP_DIR/$DATABASE_NAME' does not exist!"
            exit 1
        fi

        # Copy specific database dump to container
        docker cp "$DUMP_DIR/$DATABASE_NAME/." $CONTAINER_NAME:/tmp/mongorestore/$DATABASE_NAME/

        # Restore specific database
        docker exec $CONTAINER_NAME mongorestore --db=$DATABASE_NAME /tmp/mongorestore/$DATABASE_NAME
    fi

    # Clean up dump inside container
    docker exec $CONTAINER_NAME rm -rf /tmp/mongorestore

    echo "========================================="
    echo "Restore completed successfully!"
    echo "========================================="
fi
