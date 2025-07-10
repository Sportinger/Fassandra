import React, { useState, useCallback } from 'react';
import { useAuth } from '../AuthContext'; // Import useAuth
import { ParsedScriptData, createScriptFromParsed } from '../api'; // Import API functions and type
import styles from './ScriptUploader.module.css';

interface ScriptUploaderProps {
    onScriptCreated: (scriptId: string) => void; // Callback for navigation
    onClose: () => void;
}

const ScriptUploader: React.FC<ScriptUploaderProps> = ({ onScriptCreated, onClose }) => {
    const { token } = useAuth(); // Get auth token
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null); // For general status/errors

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            setSelectedFile(event.target.files[0]);
            setStatusMessage(null); // Clear previous messages
        }
    };

    const handleUploadAndCreate = useCallback(async () => {
        if (!selectedFile || !token) {
            setStatusMessage('Please select a .docx file and ensure you are logged in.');
            return;
        }

        setIsLoading(true);
        setStatusMessage('Uploading and analyzing script...');

        const formData = new FormData();
        formData.append('scriptFile', selectedFile);

        try {
                                     // 1. Upload and Parse (using relative URL to work with Vite proxy)
            // Use relative URL so Vite development proxy handles routing to backend
            const uploadResponse = await fetch('/api/s/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });
 
             let parsedData: ParsedScriptData = null;
             if (uploadResponse.status !== 204 && uploadResponse.headers.get("content-length") !== "0") {
                 try {
                     parsedData = await uploadResponse.json();
                 } catch (parseError: any) {
                     console.error('Failed to parse JSON response from /upload:', parseError);
                     if (!uploadResponse.ok) {
                        throw new Error(`Analysis failed: HTTP ${uploadResponse.status} - Response body could not be parsed.`);
                     }
                     throw new Error('Analysis failed: Received a non-JSON response from the server.');
                 }
             }
 
             if (!uploadResponse.ok) {
                 throw new Error(parsedData?.error || `Analysis failed: HTTP ${uploadResponse.status}`);
             }
             
             if (!parsedData) {
                 throw new Error('Analysis complete, but no parsed data was returned to create the script from.');
             }

            console.log('Parsed Script Data:', parsedData);
            setStatusMessage('Analysis complete. Creating script in database...');

            // 2. Create Script from Parsed Data
            const newScriptId = await createScriptFromParsed(token, parsedData);
            console.log('Created new script with ID:', newScriptId);
            setStatusMessage('Script created successfully! Navigating to editor...');

            // 3. Navigate to the new script
            onScriptCreated(newScriptId);

            // 4. Reset state
            setSelectedFile(null);

        } catch (err: any) {
            console.error('Operation failed:', err);
            setStatusMessage(`Error: ${err.message || 'An unknown error occurred.'}`);
            setIsLoading(false); // Ensure loading is stopped on error
        } 
    }, [selectedFile, token, onScriptCreated]);

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