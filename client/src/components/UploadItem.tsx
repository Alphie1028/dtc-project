import React, { useRef } from 'react';
import '../styles/UploadItem.css';

interface UploadItemProps{
    imageUrl: string;
    mp3Url: string;
    mp3FileName: string;
}

const UploadItem: React.FC<UploadItemProps> = ({ imageUrl, mp3Url, mp3FileName }) => {
    console.log("Image URL:", imageUrl);
    console.log("MP3 URL:", mp3Url);

    const audioRef = useRef<HTMLAudioElement>(null);

    const handlePlay = () => {
        if (audioRef.current) {
            audioRef.current.play().catch(error => {
                console.error("Audio playback error:", error);
            });
        }
    };

    const handlePause = () => {
        audioRef.current?.pause();
    };

    return (
        <div className="upload-item">
            <img src={imageUrl} alt="Uploaded"/>
            <div className="controls">
                <audio ref={audioRef} src={mp3Url} preload="auto" />
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
