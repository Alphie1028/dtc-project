import React, {useState, useEffect} from 'react';
import UploadItem from './UploadItem';
import '../styles/FileUpload.css'

interface UploadResult{
    originalImage: string;
    mp3File: string;
}

const FileUpload: React.FC = () =>{
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) =>{
        const files = event.target.files;
        if(files && files.length > 0) {
            setSelectedFiles(Array.from(files));
        }
    };

    const handleUpload = async () =>{
        if(!selectedFiles.length) return;
            const formData = new FormData();
            selectedFiles.forEach(file => {
                formData.append('images', file);
            });
        try{
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData,
            });
            const data = await response.json();
            if (data.success && data.results){
                setUploadResults(prevResults => [...prevResults, ...data.results]);
            }
        }catch (error){
        console.error('Error uploading files:', error);
        }
    };

    useEffect(() =>{
        const handleBeforeUnload = () =>{
            fetch('http://localhost:5000/cleanup', { method: 'DELETE' }).catch(err =>
                console.error('Cleanup error:', err)
            );
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () =>{
            handleBeforeUnload();
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, []);

    return(
        <div className="file-upload-container">
            <h2>Multiple Image-to-Audio Uploader</h2>
            <input type="file" accept="image/*" multiple onChange={handleFileChange}/>
            <button onClick={handleUpload}>Upload</button>
            <div className="upload-results">
                {uploadResults.map((result, index) =>(
                    <UploadItem
                        key={index}
                        imageUrl={`src/assets/${result.originalImage}`}
                        mp3Url={`src/assets/${result.mp3File}`}
                        mp3FileName={result.mp3File}
                    />
                ))}
            </div>
        </div>
    );
};

export default FileUpload;
