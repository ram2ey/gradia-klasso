import fs from "fs";
import path from "path";
import { BlobServiceClient } from "@azure/storage-blob";

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || "school-documents";

export class StorageService {
  private blobServiceClient: BlobServiceClient | null = null;

  constructor() {
    if (connectionString) {
      try {
        this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        console.log("[StorageService]: Azure Blob Storage connection initialized successfully.");
      } catch (err) {
        console.error("[StorageService]: Failed to initialize Azure Blob Client, falling back to local storage.", err);
      }
    } else {
      console.log("[StorageService]: No Azure Storage connection string. Running in local storage mode.");
    }
  }

  /**
   * Uploads a file (buffer) and returns its accessible URL path.
   * 
   * @param fileBuffer The buffer contents of the file
   * @param fileName The name of the file to save
   * @param mimeType The file mime type
   */
  async uploadFile(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<string> {
    const uniqueFileName = `${Date.now()}-${fileName.replace(/\s+/g, "_")}`;

    // 1. Azure Storage Upload
    if (this.blobServiceClient) {
      try {
        const containerClient = this.blobServiceClient.getContainerClient(containerName);
        await containerClient.createIfNotExists({ access: "container" });
        
        const blockBlobClient = containerClient.getBlockBlobClient(uniqueFileName);
        await blockBlobClient.upload(fileBuffer, fileBuffer.length, {
          blobHTTPHeaders: { blobContentType: mimeType }
        });
        
        return blockBlobClient.url;
      } catch (err) {
        console.error("[StorageService]: Azure upload failed, falling back to local file upload.", err);
      }
    }

    // 2. Local Storage Fallback
    const localUploadsDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(localUploadsDir)) {
      fs.mkdirSync(localUploadsDir, { recursive: true });
    }

    const localFilePath = path.join(localUploadsDir, uniqueFileName);
    fs.writeFileSync(localFilePath, fileBuffer);

    // Return local relative access URL
    // In production this maps to the server's static folders
    return `/uploads/${uniqueFileName}`;
  }
}
