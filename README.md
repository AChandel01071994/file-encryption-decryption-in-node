# File Encryption & Decryption in nodejs
Typescript API to encrypt and decrypt any type of file (using `AES256` encryption) in node js

## Installation & Dependencies

```sh
npm i zlib
npm i app-root-path
npm i uuid
```

## Usage
Place ts file into you service folder and import the FileService class inside your controller/service to use it

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
