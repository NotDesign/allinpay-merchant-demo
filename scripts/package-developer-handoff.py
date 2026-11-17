#!/usr/bin/env python3
# This branch delegates to the readable edition; upstream fixed-commit packaging is archived in Git.
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).with_name('package-readable.py')),run_name='__main__')
