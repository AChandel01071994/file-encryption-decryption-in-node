# File Encryption & Decryption in nodejs

Typescript API to encrypt and decrypt any type of file (using `AES256` encryption) with compression enabled

## Requirements

- node >= 10

## Installation & Dependencies

```sh
npm install zlib app-root-path uuid
```

## Usage
Place `file-service.ts` file into you service folder and import the FileService class inside your controller/service to use it

```javascript
import FileService from './file-service';

// file object received from multer
const fileObject = req.files['aadharCardImage'][0];

// encrypt and save the file
await FileService.Instance.saveFile(fileObject, FileService.Instance.bucket.uploads, 'image', 'invalid aadhar card image')

// decrypt and send to user
async getFiles(req: Request, res: Response, next: NextFunction): Promise<void> {
  await FileService.Instance.decryptAndSend(FileService.Instance.bucket.uploads, 'filename.png', res)
}

// delete file
await FileService.Instance.deleteFile(FileService.Instance.bucket.uploads, 'filename.png')

```

## TODO
Publish as a npm package
