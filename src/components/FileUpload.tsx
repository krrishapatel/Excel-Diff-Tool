import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface FileUploadProps {
  label: string;
  onFile: (file: File) => void;
  fileName?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({ label, onFile, fileName }) => {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length > 0) onFile(accepted[0]);
    },
    [onFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    multiple: false,
  });

  return (
    <div
      {...getRootProps()}
      style={{
        border: '2px dashed',
        borderColor: isDragActive ? '#4f46e5' : '#d1d5db',
        borderRadius: 8,
        padding: '24px 16px',
        textAlign: 'center',
        cursor: 'pointer',
        backgroundColor: isDragActive ? '#eef2ff' : fileName ? '#f0fdf4' : '#fafafa',
        transition: 'all 0.2s',
      }}
    >
      <input {...getInputProps()} />
      <p style={{ margin: 0, fontWeight: 600, color: '#374151' }}>{label}</p>
      {fileName ? (
        <p style={{ margin: '8px 0 0', color: '#059669', fontSize: 14 }}>✓ {fileName}</p>
      ) : (
        <p style={{ margin: '8px 0 0', color: '#6b7280', fontSize: 14 }}>
          Drag & drop .xlsx or click to browse
        </p>
      )}
    </div>
  );
};
