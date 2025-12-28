# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for VidGo Django backend
Run with: pyinstaller backend.spec
"""

import os
import sys
from pathlib import Path

# Get the backend directory
backend_dir = Path('.').resolve()

a = Analysis(
    ['manage.py'],
    pathex=[str(backend_dir)],
    binaries=[],
    datas=[
        # Include Django apps
        ('vid_go', 'vid_go'),
        ('video', 'video'),
        ('accounts', 'accounts'),
        ('utils', 'utils'),
        ('config', 'config'),
    ],
    hiddenimports=[
        'django',
        'django.contrib.admin',
        'django.contrib.auth',
        'django.contrib.contenttypes',
        'django.contrib.sessions',
        'django.contrib.messages',
        'django.contrib.staticfiles',
        'corsheaders',
        'rest_framework',
        'PIL',
        'cv2',
        'ffmpeg',
        'yt_dlp',
        'openai',
        'librosa',
        'soundfile',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='vidgo-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,  # Keep console for debugging; set to False for release
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='vidgo-backend',
)
