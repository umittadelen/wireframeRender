(function () {
    var IDENTITY_MATRIX = [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
    ];

    var CUBE_SIZE = 100;
    var CUBE_VERTICES = [
        [-CUBE_SIZE, -CUBE_SIZE, -CUBE_SIZE], [CUBE_SIZE, -CUBE_SIZE, -CUBE_SIZE],
        [CUBE_SIZE, CUBE_SIZE, -CUBE_SIZE], [-CUBE_SIZE, CUBE_SIZE, -CUBE_SIZE],
        [-CUBE_SIZE, -CUBE_SIZE, CUBE_SIZE], [CUBE_SIZE, -CUBE_SIZE, CUBE_SIZE],
        [CUBE_SIZE, CUBE_SIZE, CUBE_SIZE], [-CUBE_SIZE, CUBE_SIZE, CUBE_SIZE]
    ];
    var CUBE_EDGES = [
        [0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6],
        [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]
    ];

    function multiply(A, B) {
        var C = new Array(9).fill(0);
        for (var i = 0; i < 3; i++) {
            for (var j = 0; j < 3; j++) {
                C[i * 3 + j] = A[i * 3 + 0] * B[0 * 3 + j] +
                               A[i * 3 + 1] * B[1 * 3 + j] +
                               A[i * 3 + 2] * B[2 * 3 + j];
            }
        }
        return C;
    }

    function dot3(a, b) {
        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    }

    function cross3(a, b) {
        return [
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0]
        ];
    }

    function normalize3(v) {
        var len = Math.hypot(v[0], v[1], v[2]);
        if (len < 1e-8) return null;
        return [v[0] / len, v[1] / len, v[2] / len];
    }

    function orthonormalize(M) {
        var r0 = [M[0], M[1], M[2]];
        var r1 = [M[3], M[4], M[5]];

        var x = normalize3(r0);
        if (!x) return IDENTITY_MATRIX.slice();

        var proj = dot3(r1, x);
        var yBase = [r1[0] - proj * x[0], r1[1] - proj * x[1], r1[2] - proj * x[2]];
        var y = normalize3(yBase);
        if (!y) {
            y = Math.abs(x[0]) < 0.9 ? normalize3(cross3([1, 0, 0], x)) : normalize3(cross3([0, 1, 0], x));
        }

        var z = normalize3(cross3(x, y));
        var yFixed = normalize3(cross3(z, x));

        return [
            x[0], x[1], x[2],
            yFixed[0], yFixed[1], yFixed[2],
            z[0], z[1], z[2]
        ];
    }

    function transpose(M) {
        return [M[0], M[3], M[6], M[1], M[4], M[7], M[2], M[5], M[8]];
    }

    function rotateVertex(vertex, M) {
        return [
            vertex[0] * M[0] + vertex[1] * M[1] + vertex[2] * M[2],
            vertex[0] * M[3] + vertex[1] * M[4] + vertex[2] * M[5],
            vertex[0] * M[6] + vertex[1] * M[7] + vertex[2] * M[8]
        ];
    }

    function perspectiveProject(x, y, z, width, height, fov) {
        var scale = fov / (fov + z);
        return [x * scale + width / 2, y * scale + height / 2];
    }

    function clamp01(v) {
        return Math.max(0, Math.min(1, v));
    }

    function linearToSrgb(v) {
        if (v <= 0.0031308) return 12.92 * v;
        return 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    }

    function oklchToRgba8(l, c, hDeg, alpha) {
        var a = c * Math.cos(hDeg * Math.PI / 180);
        var b = c * Math.sin(hDeg * Math.PI / 180);

        var l_ = l + 0.3963377774 * a + 0.2158037573 * b;
        var m_ = l - 0.1055613458 * a - 0.0638541728 * b;
        var s_ = l - 0.0894841775 * a - 1.2914855480 * b;

        var l3 = l_ * l_ * l_;
        var m3 = m_ * m_ * m_;
        var s3 = s_ * s_ * s_;

        var rLin = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
        var gLin = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
        var bLin = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

        return [
            Math.round(clamp01(linearToSrgb(rLin)) * 255),
            Math.round(clamp01(linearToSrgb(gLin)) * 255),
            Math.round(clamp01(linearToSrgb(bLin)) * 255),
            Math.round(clamp01(alpha) * 255)
        ];
    }

    function drawLine(data, pixelWidth, pixelHeight, x0, y0, x1, y1, colorRgba) {
        x0 = Math.round(x0);
        y0 = Math.round(y0);
        x1 = Math.round(x1);
        y1 = Math.round(y1);

        var dx = Math.abs(x1 - x0);
        var sx = x0 < x1 ? 1 : -1;
        var dy = -Math.abs(y1 - y0);
        var sy = y0 < y1 ? 1 : -1;
        var err = dx + dy;

        while (true) {
            if (x0 >= 0 && y0 >= 0 && x0 < pixelWidth && y0 < pixelHeight) {
                var idx = 4 * (x0 + y0 * pixelWidth);
                data[idx] = colorRgba[0];
                data[idx + 1] = colorRgba[1];
                data[idx + 2] = colorRgba[2];
                data[idx + 3] = colorRgba[3];
            }
            if (x0 === x1 && y0 === y1) break;
            var e2 = 2 * err;
            if (e2 >= dy) {
                err += dy;
                x0 += sx;
            }
            if (e2 <= dx) {
                err += dx;
                y0 += sy;
            }
        }
    }

    function drawWireframe(ctx, width, height, matrix, options) {
        var config = options || {};
        var fov = config.fov || 500;
        var dpr = config.dpr || window.devicePixelRatio || 1;
        var l = config.oklchL == null ? 0.8608 : config.oklchL;
        var c = config.oklchC == null ? 0.3412 : config.oklchC;
        var h = config.oklchH == null ? 142.4953 : config.oklchH;
        var alpha = config.alpha == null ? 1 : config.alpha;

        var pixelWidth = Math.floor(width * dpr);
        var pixelHeight = Math.floor(height * dpr);
        var imageData = ctx.createImageData(pixelWidth, pixelHeight);
        var data = imageData.data;
        var colorRgba = oklchToRgba8(l, c, h, alpha);

        for (var i = 0; i < CUBE_EDGES.length; i++) {
            var start = CUBE_EDGES[i][0];
            var end = CUBE_EDGES[i][1];

            var v1 = rotateVertex(CUBE_VERTICES[start], matrix);
            var v2 = rotateVertex(CUBE_VERTICES[end], matrix);
            var p1 = perspectiveProject(v1[0], v1[1], v1[2], width, height, fov);
            var p2 = perspectiveProject(v2[0], v2[1], v2[2], width, height, fov);

            drawLine(data, pixelWidth, pixelHeight, p1[0] * dpr, p1[1] * dpr, p2[0] * dpr, p2[1] * dpr, colorRgba);
        }

        ctx.clearRect(0, 0, width, height);
        ctx.putImageData(imageData, 0, 0);
    }

    window.CubeCore = {
        IDENTITY_MATRIX: IDENTITY_MATRIX.slice(),
        multiply: multiply,
        dot3: dot3,
        cross3: cross3,
        normalize3: normalize3,
        orthonormalize: orthonormalize,
        transpose: transpose,
        drawWireframe: drawWireframe
    };
})();
