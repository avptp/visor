#!/usr/bin/env python3
"""Àlies de genera_autonom.py (es manté per compatibilitat)."""
import runpy
from pathlib import Path

runpy.run_path(str(Path(__file__).with_name('genera_autonom.py')), run_name='__main__')
