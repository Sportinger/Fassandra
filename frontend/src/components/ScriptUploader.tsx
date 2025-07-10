import React, { useState, useCallback } from 'react';
import { useAuth } from '../AuthContext';
import { Script, UploadStatus } from '../types';
import styles from './ScriptUploader.module.css';

// Extended Script interface for placeholder with file data
interface PlaceholderScript extends Script {
    fileData?: File; // Add file for real upload
}

interface ScriptUploaderProps {
    onScriptCreated: (scriptId: string) => void;
    onClose: () => void;
    onBackgroundUploadStart: (placeholder: PlaceholderScript) => void; // Use extended type
}

const ScriptUploader: React.FC<ScriptUploaderProps> = ({ 
    onScriptCreated, 
    onClose, 
    onBackgroundUploadStart 
}) => {
    const { token } = useAuth();
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            setSelectedFile(event.target.files[0]);
            setStatusMessage(null);
        }
    };

    const handleUploadAndCreate = useCallback(async () => {
        if (!selectedFile || !token) {
            setStatusMessage('Please select a .docx file and ensure you are logged in.');
            return;
        }

        console.log('[ScriptUploader] 🚀 Starting background upload for:', selectedFile.name);

        // Create placeholder script with file data for real upload
        const placeholderId = `placeholder-${Date.now()}`;
        const placeholder: PlaceholderScript = {
            id: placeholderId,
            title: selectedFile.name.replace('.docx', ''),
            created_by: null,
            created_at: new Date().toISOString(),
            is_public: false,
            thumbnail: null,
            isPlaceholder: true,
            uploadStatus: 'uploading' as UploadStatus,
            uploadProgress: 0,
            uploadError: null,
            fileData: selectedFile // 🚀 NEW: Include file for real upload
        };

        // Pass placeholder to parent - this will trigger background upload
        onBackgroundUploadStart(placeholder);
        
        // Close modal immediately for better UX
        onClose();
        
        console.log('[ScriptUploader] ✅ Modal closed, upload delegated to ScriptList');

        // Reset state
        setSelectedFile(null);
        setIsLoading(false);
        setStatusMessage(null);

    }, [selectedFile, token, onBackgroundUploadStart, onClose]);

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <button className={styles.closeButton} onClick={onClose}>×</button>
                <h2>Upload New Script</h2>
                <div>
                    <input 
                        type="file" 
                        accept=".docx" 
                        onChange={handleFileChange} 
                        disabled={isLoading}
                    />
                </div>
                {selectedFile && (
                    <p style={{ margin: '10px 0' }}>Selected: {selectedFile.name}</p>
                )}
                <button 
                    onClick={handleUploadAndCreate} 
                    disabled={!selectedFile || isLoading} 
                    style={{ marginTop: '10px' }}
                >
                    {isLoading ? statusMessage || 'Processing...' : 'Upload and Create Script'}
                </button>

                {statusMessage && !isLoading && (
                     <p style={{ color: statusMessage.startsWith('Error:') ? 'red' : 'inherit', marginTop: '10px' }}>
                         {statusMessage}
                     </p>
                )}
            </div>
        </div>
    );
};

export default ScriptUploader;
export type { PlaceholderScript }; 