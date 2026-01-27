import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import api from '../services/api';

interface UserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => Promise<void>;
    initialData?: any;
}

export const UserModal = ({ isOpen, onClose, onSubmit, initialData }: UserModalProps) => {
    const [formData, setFormData] = useState({
        name: '',
        surname: '',
        email: '',
        password: '',
        phone: '',
        role_id: '',
        library_ids: [] as string[]
    });
    const [roles, setRoles] = useState<any[]>([]);
    const [libraries, setLibraries] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchOptions = async () => {
            try {
                const [rolesRes, libsRes] = await Promise.all([
                    api.get('/roles'),
                    api.get('/libraries')
                ]);

                // Filter Roles for Librarian
                const userString = localStorage.getItem('user');
                const currentUser = userString ? JSON.parse(userString) : null;
                const isLibrarian = currentUser?.role === 'librarian';

                if (isLibrarian) {
                    setRoles(rolesRes.data.filter((r: any) => r.role_name === 'user'));
                    setLibraries(libsRes.data);
                } else {
                    setRoles(rolesRes.data);
                    setLibraries(libsRes.data);
                }
            } catch (error) {
                console.error('Failed to fetch options', error);
            }
        };

        if (isOpen) {
            fetchOptions();
        }
    }, [isOpen]);

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name,
                surname: initialData.surname || '',
                email: initialData.email,
                password: '', // Don't show existing password
                phone: initialData.phone || '',
                role_id: initialData.role?.id || initialData.role_id || '',
                library_ids: initialData.libraries ? initialData.libraries.map((l: any) => l.id) : []
            });
        } else {
            setFormData({
                name: '',
                surname: '',
                email: '',
                password: '',
                phone: '',
                role_id: '',
                library_ids: []
            });
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            if (initialData) {
                const updateData = { ...formData };
                if (!updateData.password) delete (updateData as any).password;
                await api.put(`/users/${initialData.id}`, updateData);
            } else {
                await api.post('/users', formData);
            }
            await onSubmit();
            onClose();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to save user');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLibraryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
        setFormData({ ...formData, library_ids: selectedOptions });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-xl font-semibold">
                        {initialData ? 'Edit User' : 'Add New User'}
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Name</label>
                            <input
                                type="text"
                                required
                                className="input"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Surname</label>
                            <input
                                type="text"
                                required
                                className="input"
                                value={formData.surname}
                                onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Email</label>
                        <input
                            type="email"
                            required
                            className="input"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Password {initialData && '(Leave blank to keep current)'}</label>
                        <input
                            type="password"
                            required={!initialData}
                            minLength={6}
                            className="input"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Phone</label>
                        <input
                            type="tel"
                            required
                            className="input"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Role</label>
                            <select
                                required
                                className="input"
                                value={formData.role_id}
                                onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                            >
                                <option value="">Select Role</option>
                                {roles.map(role => (
                                    <option key={role.id} value={role.id}>{role.role_name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Libraries <span className="text-xs text-gray-500 font-normal">(Hold Cmd/Ctrl to select multiple)</span>
                            </label>
                            <select
                                multiple
                                required
                                className="input min-h-[100px]"
                                value={formData.library_ids}
                                onChange={handleLibraryChange}
                            >
                                {libraries.map(lib => (
                                    <option key={lib.id} value={lib.id}>{lib.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>


                    <div className="pt-4 flex gap-3 justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border rounded hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="h-10 px-6 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-medium transition-all shadow-sm hover:shadow active:scale-95 flex items-center gap-2 whitespace-nowrap"
                        >
                            <Save size={18} />
                            {isLoading ? 'Saving...' : 'Save User'}
                        </button>
                    </div>
                </form>
            </div >
        </div >
    );
};
