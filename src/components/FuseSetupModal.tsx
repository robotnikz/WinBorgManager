import React from 'react';
import { Copy, AlertTriangle } from 'lucide-react';
import Button from './Button';

interface FuseSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FuseSetupModal: React.FC<FuseSetupModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  // Updated command including python bindings and libfuse2 which are crucial for Borg
  const command = "sudo apt update && sudo apt install fuse libfuse2 python3-llfuse python3-pyfuse3 -y && sudo chmod 666 /dev/fuse";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white rounded-xl shadow-2xl border border-red-100 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-red-100 rounded-full text-red-600">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">WSL Configuration Required</h3>
                        <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                            Borg requires <strong>FUSE bindings</strong> to mount archives. Your current installation is missing the Python libraries needed for this.
                        </p>
                    </div>
                </div>

                <div className="mt-6 bg-slate-900 rounded-lg p-4 relative group">
                    <p className="text-xs text-slate-400 mb-2 font-mono">Run this in your WSL terminal (Ubuntu):</p>
                    <code className="text-sm text-green-400 font-mono break-all block pr-8">
                        {command}
                    </code>
                    <button 
                        onClick={() => {
                            navigator.clipboard.writeText(command);
                            alert("Command copied to clipboard!");
                        }}
                        className="absolute top-8 right-3 p-2 bg-slate-800 text-slate-400 hover:text-white rounded transition-colors"
                        title="Copy to clipboard"
                    >
                        <Copy className="w-4 h-4" />
                    </button>
                </div>
            </div>
            
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end">
                <Button onClick={onClose}>Done</Button>
            </div>
        </div>
    </div>
  );
};

export default FuseSetupModal;