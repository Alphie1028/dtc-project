import React, { useRef } from 'react';
import '../styles/UploadItem.css';

interface UploadItemProps{
    imageUrl: string;
    mp3Url: string;
    mp3FileName: string;
}

const UploadItem: React.FC<UploadItemProps> = ({ imageUrl, mp3Url, mp3FileName }) =>{
    const audioRef = useRef<HTMLAudioElement>(null);

    const handlePlay = () =>{
        audioRef.current?.play();
    };

    const handlePause = () =>{
        audioRef.current?.pause();
    };

    return(
        <div className="upload-item">
            <img src={imageUrl} alt="Uploaded"/>
            <div className="controls">
                <button onClick={handlePlay}>Play</button>
                <button onClick={handlePause}>Pause</button>
                <a href={mp3Url} download={mp3FileName}>
                    <button>Download</button>
                </a>
            </div>
        </div>
        );
};

export default UploadItem;
