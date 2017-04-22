module.exports = function(RED) {

    if (false) { // Test for nodes compatibilities
        throw "Info : not compatible";
    }

    function NodeConstructor(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        node.on('input', function(msg) {
            node.send(msg);
        });
        node.on("close", function() {
        });
    };
    RED.nodes.registerType("postgrestor", NodeConstructor);
}