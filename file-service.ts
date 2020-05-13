import * as fs from 'fs';
import { Transform } from 'stream';
import * as zlib from 'zlib';
import * as crypto from 'crypto';
import * as appRoot from 'app-root-path';
import { v4 as uuidv4 } from 'uuid';
import { Response } from 'express';

// typings not available, can not use import
const streamifier = require('streamifier');

// typings for file type
export declare type AllowedFileType = 'image' | 'pdf' | 'any';

export default class FileService {
    private static _instance: FileService;

    static get Instance(): FileService {
        if (!this._instance) {
            this._instance = new this();
        }
        return this._instance;
    }

    encrytionKey: string;
    validImageFiles = [
        'image/png',
        'image/jpeg',
        'image/jpg'
    ];
    validPDFFiles = [
        'application/pdf',
    ];
    bucket = {
        uploads: '/uploads'
    };

    constructor() {
        // fetch secret from env
        this.encrytionKey = 'somesecretkey';
        // throw error in case of no key
        if (!this.encrytionKey) {
            throw new Error('file encryption key does not exist');
        }
    }

    /**
     * 
     * @param type file type to validate
     * @param mimeType mime type of file
     */
    isValidFile(type: AllowedFileType, mimeType: string): boolean {
        if (type === 'image') return this.validImageFiles.indexOf(mimeType) !== -1;
        if (type === 'pdf') return this.validPDFFiles.indexOf(mimeType) !== -1;
        return true;
    }

    /**
     * save given file to destination location/bucket
     * @param file file object received from multer
     * @param bucket destination directory/location for file storage
     * @param allowedFileType valid file type
     * @param errorMessage error message to throw in case of error
     * @param isEncryption encryption boolean
     */
    async saveFile(file: any, bucket: string, allowedFileType: AllowedFileType, errorMessage = 'invalid file', isEncryption = true): Promise<string> {
        // fetch meta data
        const mimeType = <string>file.mimetype,
            ext = (file.originalname as string).split('.')[1],
            fileSize = file.size,
            fileName = `${uuidv4()}_${fileSize}_${mimeType.replace('/', '_')}.${ext}`;

        //validate fileType
        if (!this.isValidFile(allowedFileType, mimeType))
            throw new Error(errorMessage);

        // create/check directories & save
        const fullpath = `${appRoot}${bucket}`;
        // validate location/directories
        await fs.promises.mkdir(fullpath, { recursive: true });
        // if encryption is enabled, encrypt and save the file
        if (isEncryption) await this.encryptAndSave(file.buffer, bucket, fileName);
        // else save the file directly without encryption
        else await fs.promises.writeFile(`${fullpath}/${fileName}`, file.buffer)
        // return file name
        return fileName;
    }

    /**
     * delete the given file from storage
     * @param filePath file location
     * @param fileName name of the file
     */
    async deleteFile(filePath: string, fileName: string): Promise<void> {
        const fullPath = `${appRoot}${filePath}/${fileName}`;
        if (fs.existsSync(fullPath)) {
            await fs.promises.unlink(fullPath);
        }
    }

    /**
     * encrypt file and save to destination
     * @param file file can be buffer or source location with filename
     * @param bucket destination directory/location for file storage
     * @param fileName name of the file 
     * @param isBuffer boolean to mention if file is buffer or string
     */
    encryptAndSave(file: Buffer | string, bucket: string, fileName: string, isBuffer = true): Promise<string> {
        return new Promise((resolve, reject) => {
            // prepend app root path
            const dest = `${appRoot}${bucket}/${fileName}`;
            // Generate a secure, pseudo random initialization vector.
            const initVect = crypto.randomBytes(16);
            // Generate a cipher key from the encryption key
            const CIPHER_KEY = this.getCipherKey();
            // const readStream = fs.createReadStream(file);

            // create stream from buffer data or file path
            const readStream = isBuffer ? streamifier.createReadStream(file) : fs.createReadStream(file);
            // compression
            const gzip = zlib.createGzip();
            // encryption
            const cipher = crypto.createCipheriv('aes256', CIPHER_KEY, initVect);
            // prepend initialization vector into file
            const appendInitVect = new AppendInitVect(initVect);
            // Create a write stream with a different file extension.
            const writeStream = fs.createWriteStream(dest);
            // pipeline streams
            readStream
                .pipe(gzip)
                .pipe(cipher)
                .pipe(appendInitVect)
                .pipe(writeStream)
                .on('finish', () => resolve('success'))
                .on('error', () => reject('encryption failed'));
        })

    }

    /**
     * decrypt given file and stream it in response
     * @param bucket source location/directory
     * @param fileName name of the file
     * @param res express response object to send the file to user as a stream
     */
    decryptAndSend(bucket: string, fileName: string, res: Response) {
        // prepend app root path
        const dest = `${appRoot}${bucket}/${fileName}`;
        // if file does not exists, return not found image
        if (!fs.existsSync(dest)) {
            res.sendfile(`${appRoot}${this.bucket.uploads}/file-not-found.png`);
        } else {
            // First, get the initialization vector from the file.
            const readInitVect = fs.createReadStream(dest, { end: 15 });
            let initVect: any = null;
            readInitVect.on('data', (chunk) => {
                initVect = chunk;
            });

            // Once we’ve got the initialization vector, we can decrypt the file.
            readInitVect.on('close', () => {
                // get encryption key
                const cipherKey = this.getCipherKey();
                // read data while skipping init vector
                const readStream = fs.createReadStream(dest, { start: 16 });
                // decrypt
                const decipher = crypto.createDecipheriv('aes256', cipherKey, initVect);
                // decompress
                const unzip = zlib.createUnzip();
                // const writeStream = fs.createWriteStream(file + '.unenc');
                // fetch metainfo from filename
                const meta = this.getMetaInfo(fileName);
                // write headers
                res.writeHead(200, {
                    'Content-Type': meta.mime,
                    'Content-Length': meta.fileSize

                })
                // pipeline streams
                readStream
                    .pipe(decipher)
                    .pipe(unzip)
                    .pipe(res)
                // .pipe(writeStream);
            });
        }
    }

    /**
     * generate deterministic hash from encryption key
     */
    getCipherKey() {
        // generate encryption hash from key
        return crypto.createHash('sha256').update(this.encrytionKey).digest();
    }

    /**
     * parse meta info from file name
     * @param fileName file name
     */
    getMetaInfo(fileName: string) {
        const name = fileName.split('.')[0];
        const arr = name.split('_'), len = arr.length;
        return {
            mime: `${arr[len - 2]}/${arr[len - 1]}`,
            fileSize: Number(arr[len - 3])
        }
    }
}
// to prepend initialization vector in stream
class AppendInitVect extends Transform {
    initVect: Buffer;
    appended: boolean;
    constructor(initVect: Buffer, opts?: any) {
        super(opts);
        this.initVect = initVect;
        this.appended = false;
    }

    _transform(chunk: any, encoding: any, cb: any) {
        if (!this.appended) {
            this.push(this.initVect);
            this.appended = true;
        }
        this.push(chunk);
        cb();
    }
}
