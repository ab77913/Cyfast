from setuptools import setup, find_packages
from os.path import join, dirname

# Read the version from __version__.py
version_file = join(dirname(__file__), 'test_agent', '__version__.py')
exec(open(version_file).read())


setup(
    name='cyfasttestagent',
    version=__version__,
    packages=find_packages(),
    install_requires=[
        'pika == 1.3.2',
        'unique_names_generator == 1.0.2',
        'gitpython == 3.1.32',
        'python-dotenv == 1.0.0',
        'requests == 2.31.0',
        'pytest == 7.4.0',
        'pytest-html == 3.2.0',
        'pytest-bdd == 6.1.1',
        'robotframework == 6.1.1',
        'py == 1.11.0',
        'python_logging_rabbitmq == 2.2.0',
        'pytest-json-report == 1.5.0',
        'PyYAML == 6.0.1'
    ],
    package_data={
        'test_agent.config': ['*.json']
    },
    entry_points={
        'console_scripts': [
            'cyfasttestagent = test_agent.test_agent:main',
        ],
    },
)
