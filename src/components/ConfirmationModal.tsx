import React from 'react';

interface ConfirmationModalProps {
  title: string;
  message: string;
  items: { id: number | string; title: string; url?: string }[];
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  title,
  message,
  items,
  onConfirm,
  onCancel,
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[10000]">
      <div className="bg-gray-800 text-white rounded-lg shadow-lg p-6 w-1/3 max-w-md">
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        <p className="mb-4">{message}</p>
        <ul className="max-h-48 overflow-y-auto mb-4 border border-gray-700 rounded-md p-2">
          {items.map((item) => (
            <li key={item.id} className="text-sm truncate">
              {item.title} {item.url && <span className="text-gray-400">({new URL(item.url).hostname})</span>}
            </li>
          ))}
        </ul>
        <div className="flex justify-end space-x-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md bg-gray-600 hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
