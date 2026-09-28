import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api/auth';

export const UserMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, refreshToken, clear } = useAuthStore();
  const navigate = useNavigate();

  if (!user) return null;

  const handleSignOut = async () => {
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch (err) {
      console.error('Logout failed', err);
    } finally {
      clear();
      navigate('/login');
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', 
          cursor: 'pointer', padding: '0.5rem', borderRadius: '4px'
        }}
      >
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: '#374151'
        }}>
          {user.username.charAt(0).toUpperCase()}
        </div>
        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>{user.username}</span>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', marginTop: '0.5rem', width: '200px',
          backgroundColor: 'white', borderRadius: '6px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
          border: '1px solid #e5e7eb', zIndex: 50
        }}>
          <div style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>
            <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 500, color: '#111827' }}>{user.full_name || user.username}</p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>{user.email}</p>
            <span style={{ 
              display: 'inline-block', marginTop: '0.25rem', padding: '0.125rem 0.375rem', 
              fontSize: '0.7rem', fontWeight: 500, backgroundColor: '#f3f4f6', color: '#374151', borderRadius: '9999px'
            }}>
              {user.role}
            </span>
          </div>
          <div style={{ padding: '0.5rem' }}>
            {user.role === 'admin' && (
              <button 
                onClick={() => { setIsOpen(false); navigate('/admin'); }}
                style={{
                  width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '0.5rem 0.75rem',
                  fontSize: '0.875rem', color: '#4f46e5', cursor: 'pointer', borderRadius: '4px', fontWeight: 500
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                Admin console
              </button>
            )}
            <button 
              onClick={() => { setIsOpen(false); navigate('/my-tasks'); }}
              style={{
                width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '0.5rem 0.75rem',
                fontSize: '0.875rem', color: '#374151', cursor: 'pointer', borderRadius: '4px'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              My tasks
            </button>
            <button 
              onClick={handleSignOut}
              style={{
                width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '0.5rem 0.75rem',
                fontSize: '0.875rem', color: '#ef4444', cursor: 'pointer', borderRadius: '4px'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
