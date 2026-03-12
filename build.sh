#!/bin/bash
#
# Build Kill Bill server
# Usage: ./build.sh [--quick]
#

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
KB_DIR="$SCRIPT_DIR/killbill-server"
JAVA_HOME="/home/mustafa/.sdkman/candidates/java/17.0.16-librca"
export JAVA_HOME
export PATH="$JAVA_HOME/bin:$PATH"

echo "Building Kill Bill..."
echo "Java: $(java -version 2>&1 | head -1)"
echo ""

cd "$KB_DIR"

if [ "$1" = "--quick" ]; then
    echo "Quick build (skip tests, docs, rat check)..."
    mvn install -DskipTests -Dcheck.skip-rat=true -Dmaven.javadoc.skip=true -pl profiles/killbill -am
else
    echo "Full build (skip tests)..."
    mvn clean install -DskipTests -Dcheck.skip-rat=true -Dmaven.javadoc.skip=true
fi

echo ""
echo "Build complete. Run ./start.sh to start the server."
