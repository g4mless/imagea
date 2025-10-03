# Image API with Hono + ImageKit

A minimal HTTP API to upload and manage images on ImageKit, built with Hono and Node.js.

## Prerequisites
- Node.js 18+ (recommended)
- ImageKit account with:
  - IMAGEKIT_PUBLIC_KEY
  - IMAGEKIT_PRIVATE_KEY
  - IMAGEKIT_URL_ENDPOINT

## Install
```
npm install
```

## Configure environment
Create a .env file in the project root with the following keys:
```
IMAGEKIT_PUBLIC_KEY=your_public_key
IMAGEKIT_PRIVATE_KEY=your_private_key
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_imagekit_id
PORT=3000
```

Tip: You can also copy from the example and then edit:
```
cp .env.example .env
```

## Run the server
Development (with tsx):
```
npm run dev
```

Build and run:
```
npm run build
npm start
```

Server runs at:
- http://localhost:3000

## Endpoints

- GET /
  - Health check. Returns "ok".

- GET /api/imagekit-auth
  - Auth parameters for client-side ImageKit SDK.

- GET /api/images
  - List images. Query:
    - limit: number (default 20, max 100)
    - skip: number (default 0)
    - folder (alias path): list under a folder, e.g. /uploads

- GET /api/images/:fileId
  - Single file details.

- POST /api/images
  - Upload image.
  - Content types:
    - multipart/form-data: field "file" (or "image"), optional "fileName", "folder"
    - application/json: base64 in "file" (or "base64"), optional "fileName", "folder"

- DELETE /api/images/:fileId
  - Delete by fileId.

Response shape (upload, list, detail):
```
{
  "id": "FILE_ID",
  "type": "file",
  "name": "filename.ext",
  "filetype": "image" | "non-image" | "video" | "image/jpeg",
  "url": "https://ik.imagekit.io/.../filename.ext",
  "thumbnail": "https://ik.imagekit.io/.../tr:n-ik_ml_thumbnail"
}
```

## cURL examples (Windows)

- List images
```
curl http://localhost:3000/api/images
```

- List with folder + pagination
```
curl "http://localhost:3000/api/images?limit=10&skip=0"
```

- Get details
```
curl http://localhost:3000/api/images/FILE_ID_HERE
```

- Upload (multipart, cmd.exe)
```
curl -X POST http://localhost:3000/api/images ^
  -F "file=@C:\path\to\image.jpg" ^
  -F "fileName=image.jpg" ^
  -F "folder=/uploads"
```

- Upload (multipart, PowerShell)
```
curl.exe -X POST http://localhost:3000/api/images `
  -F "file=@C:\path\to\image.jpg" `
  -F "fileName=image.jpg" `
  -F "folder=/uploads"
```

- Upload (JSON base64, PowerShell)
```
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\image.png"))
$body = @{ file = "data:image/png;base64,$b64"; fileName = "image.png"; folder = "/uploads" } | ConvertTo-Json
curl.exe -X POST http://localhost:3000/api/images -H "Content-Type: application/json" -d $body
```

- Delete
```
curl -X DELETE http://localhost:3000/api/images/FILE_ID_HERE
```

## Notes
- Trailing slash is accepted (strict routing disabled).
- CORS enabled for all origins; restrict as needed in [src/index.ts](src/index.ts).
- Ensure .env is set as described above.
