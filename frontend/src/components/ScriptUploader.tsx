import React, { useState, useCallback, useMemo } from 'react';
import { useAuth } from '../AuthContext';
import { PlaceholderScript, UploadStatus } from '../types';
import styles from './ScriptUploader.module.css';

import logger from '../services/LoggingService';
import { useUploadState } from '../hooks/useUploadState';
import { ClaudeSessionService } from '../services/ClaudeSessionService';
interface ScriptUploaderProps {
    onScriptCreated?: (scriptId: string) => void;
    onClose: () => void;
    onBackgroundUploadStart: (placeholder: PlaceholderScript) => void;
}

const ScriptUploader: React.FC<ScriptUploaderProps> = ({ 
    onClose, 
    onBackgroundUploadStart 
}) => {
    const { token } = useAuth();
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [uploadId, setUploadId] = useState<string | null>(null);
    const { uploads, getSessionId, removeUpload } = useUploadState();

    const activeUpload = useMemo(() => {
        if (!uploadId) return null;
        return uploads.find(u => u.id === uploadId) || null;
    }, [uploads, uploadId]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            
            // PDF file validation
            if (!file.name.toLowerCase().endsWith('.pdf')) {
                setStatusMessage('Please select a PDF file.');
                setSelectedFile(null);
                return;
            }
            
            if (file.size > 50 * 1024 * 1024) { // 50MB limit
                setStatusMessage('File size exceeds 50MB limit.');
                setSelectedFile(null);
                return;
            }
            
            if (file.size < 1024) { // Minimum 1KB
                setStatusMessage('File too small to be a valid PDF.');
                setSelectedFile(null);
                return;
            }
            
            setSelectedFile(file);
            setStatusMessage(null);
        }
    };

    const handleUploadAndCreate = useCallback(async () => {
        if (!selectedFile || !token) {
            setStatusMessage('Please select a PDF file and ensure you are logged in.');
            return;
        }

        logger.debug('ScriptUploader', '[ScriptUploader] 🚀 Starting background upload for PDF:', selectedFile.name);

        // Create placeholder script with file data for real upload
        const placeholderId = `placeholder-${Date.now()}`;
        const placeholder: PlaceholderScript = {
            id: placeholderId,
            title: selectedFile.name.replace('.pdf', ''),
            created_by: null,
            created_at: new Date().toISOString(),
            is_public: false,
            thumbnail: null,
            isPlaceholder: true,
            uploadStatus: 'uploading' as UploadStatus,
            uploadProgress: 0,
            uploadError: null,
            fileData: selectedFile // Include file for real upload
        };

        // Start background upload via parent (ScriptList)
        onBackgroundUploadStart(placeholder);
        // Keep modal open and show realtime progress in-place
        setUploadId(placeholderId);
        setIsLoading(true);
        logger.debug('ScriptUploader', '[ScriptUploader] ✅ Background upload started; keeping modal open to display progress');

        // Reset state
        setSelectedFile(null);
        setStatusMessage(null);

    }, [selectedFile, token, onBackgroundUploadStart, onClose]);

    const handleCancelUpload = useCallback(async () => {
        if (!uploadId) return;
        try {
            const sessionId = getSessionId(uploadId);
            if (!sessionId) {
                setStatusMessage('Unable to cancel: no session ID yet.');
                return;
            }
            const wsToken = token;
            if (!wsToken || wsToken === 'authenticated') {
                setStatusMessage('Unable to cancel: missing auth token.');
                return;
            }
            const svc = new ClaudeSessionService(sessionId, wsToken, () => {}, () => {}, () => {});
            await svc.cancelSession();
            removeUpload(uploadId);
            setUploadId(null);
            setIsLoading(false);
            setSelectedFile(null);
            setStatusMessage('Upload cancelled');
        } catch (e: any) {
            logger.error('ScriptUploader', 'Cancel upload failed:', e);
            setStatusMessage(e?.message || 'Failed to cancel upload');
        }
    }, [uploadId, getSessionId, token, removeUpload]);

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <h2>📄 Upload PDF Script</h2>
                
                {!activeUpload && (
                    <div className={styles.fileInput}>
                        <input
                            type="file"
                            accept=".pdf,application/pdf"
                            onChange={handleFileChange}
                            disabled={isLoading}
                            id="script-file-input"
                        />
                        <label htmlFor="script-file-input">
                            {selectedFile ? (
                                <span>📄 {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                            ) : (
                                <span>Choose PDF File...</span>
                            )}
                        </label>
                    </div>
                )}

                {statusMessage && (
                    <div className={styles.statusMessage}>
                        {statusMessage}
                    </div>
                )}

                {!activeUpload && (
                    <div className={styles.helpText}>
                        <p><strong>📋 PDF Upload Instructions:</strong></p>
                        <ul>
                            <li>✅ Upload theater scripts as PDF files</li>
                            <li>🤖 AI will analyze your script structure automatically</li>
                            <li>🎭 Extract dialogue, stage directions, and characters</li>
                            <li>📄 Preserve original page numbers</li>
                            <li>⚡ Convert to collaborative format instantly</li>
                        </ul>
                        <p><em>File requirements: PDF format, max 50MB</em></p>
                    </div>
                )}

                {activeUpload && (
                    <div className={styles.helpText}>
                        <p><strong>Processing:</strong> {activeUpload.title}</p>
                        <div className={styles.progressBar}>
                            <div
                              className={styles.progressFill}
                              style={{ width: `${Math.max(0, Math.min(100, activeUpload.uploadProgress || 0))}%` }}
                            />
                        </div>
                        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
                          {activeUpload.uploadSubStage || 'Processing...'}
                        </div>
                    </div>
                )}

                <div className={styles.buttons}>
                    {!activeUpload && (
                        <>
                          <button
                              onClick={onClose}
                              disabled={isLoading}
                              className={styles.cancelButton}
                          >
                              Cancel
                          </button>
                          <button
                              onClick={handleUploadAndCreate}
                              disabled={!selectedFile || isLoading}
                              className={styles.uploadButton}
                          >
                              {isLoading ? 'Processing...' : '🚀 Upload & Analyze PDF'}
                          </button>
                        </>
                    )}

                    {activeUpload && (
                        <>
                          <button
                            onClick={handleCancelUpload}
                            disabled={activeUpload.uploadStatus === 'completed'}
                            className={styles.cancelButton}
                          >
                            Cancel Upload
                          </button>
                          <button
                            onClick={() => { setUploadId(null); setIsLoading(false); onClose(); }}
                            className={styles.uploadButton}
                          >
                            {activeUpload.uploadStatus === 'completed' ? 'Close' : 'Hide'}
                          </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ScriptUploader; 
