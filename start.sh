#!/bin/bash
#
# Start Kill Bill server on port 18080
# Usage: ./start.sh [--debug]
#

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
KB_DIR="$SCRIPT_DIR/killbill-server"
PROPS_FILE="$SCRIPT_DIR/killbill-server.properties"
JAVA_HOME="/home/mustafa/.sdkman/candidates/java/17.0.16-librca"
export JAVA_HOME
export PATH="$JAVA_HOME/bin:$PATH"

PORT=18080

if [ "$1" = "--debug" ]; then
    echo "Starting Kill Bill in DEBUG mode (debugger port: 18000)..."
    export MAVEN_OPTS="-Xdebug -Xnoagent -Djava.compiler=NONE -Xrunjdwp:transport=dt_socket,address=18000,server=y,suspend=n -Xmx1g"
else
    export MAVEN_OPTS="-Xmx1g"
fi

echo "Starting Kill Bill on port $PORT..."
echo "Properties: $PROPS_FILE"
echo "Java: $(java -version 2>&1 | head -1)"
echo ""

cd "$KB_DIR"
mvn -pl profiles/killbill \
    -Djetty.port=$PORT \
    -Dorg.killbill.server.properties=file://$PROPS_FILE \
    -Dlogback.configurationFile=./profiles/killbill/src/main/resources/logback.xml \
    jetty:run
