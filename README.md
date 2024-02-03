# Stream File Server

Node.js file server for uploading/ downloading files to/ from a target S3 bucket.
The server takes advantage of node **streams** for efficient upload/ download of files. In addition, a pub/sub system based on **Redis** is used, which becomes useful when using this fileserver in a microservices architecture. Other services, by subscribing to the publisher, can be informed about when the upload of a file has been completed, or if any error occurred in the file upload process.

The project provides a multicontainer app that brings an internal **redis** container, and a **minio** container, which emulates an Amazon compliant **S3** bucket service.

To launch the multicontainer up:
```
docker compose up -d
```

## Note
This is a simplified version of a similar project I maintain for my company.
Here, no authentication middleware is implemented, to avoid revealing possible flaws that could lead to attacks.

Nevertheless, a bunch of configuration options are still available. Start from the `template.env` file to build your own.

## Authors and acknowledgment

Riccardo Roberto De Lucia: riccardoroberto.delucia@gmail.com

## License

MIT