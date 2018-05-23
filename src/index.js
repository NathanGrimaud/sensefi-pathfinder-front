import registerServiceWorker from './registerServiceWorker';
import Konva, {
    isDragging
} from 'konva';
import {
    merge,
    flatten
} from 'ramda'
registerServiceWorker();
const toEven = num => Math.ceil(num / 10) * 10;

function getBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function readImage(img) {
    const image_input = document.getElementById("image_result")
    return new Promise((resolve, reject) => {
        var image = new Image();
        image_input.onload = function () {
            resolve(image);
        };
        image_input.src = img;
    });
}


function makegrid() {

    const image = document.getElementById("image_result")
    const container = document.getElementById("container")
    const width = toEven(image.width)
    const height = toEven(image.height)
    const col_arr = [...Array(height / 10).keys()].map(x => x * 10);
    const row_arr = [...Array(width / 10).keys()].map(x => x * 10);
    let drag = false
    let rect = {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
    }
    const selectionOptions = {
        x: 10,
        y: 10,
        id: 'selection',
        height: 10,
        width: 10,
        fill: 'rgba(0,0,0, 0.2)',
    }
    const selection = new Konva.Rect(selectionOptions);
    const colors = {
        block: 'rgba(255, 0, 0, 0.6)',
        start: 'rgba(0, 255, 0, 0.6)',
        path: 'rgba(0, 0, 255, 0.6)',
        empty: 'rgba(0, 0, 0, 0)'
    }


    const stage = new Konva.Stage({
        container: 'container',
        width: width,
        height: height
    });


    const layer = new Konva.Layer();
    stage.on("contentMousedown", function (event) {
        const isShift = event.evt.shiftKey
        const isAlt = event.evt.altKey
        container.style.cursor = isShift ? 'crosshair' : isAlt ? 'not-allowed' : 'no-drop'
        drag = true
        const square = event.currentTarget.clickStartShape
        rect.x = square.attrs.x
        rect.y = square.attrs.y
        selection.setAttrs(merge(selectionOptions, rect))
        layer.batchDraw()
    })

    stage.on('mousemove', function (event) {
        if (drag) {
            rect.width = -(rect.x - toEven(event.evt.clientX) + 10)
            rect.height = -(rect.y - toEven(event.evt.y) + 40)
            selection.setAttrs(merge(selectionOptions, rect))
            layer.batchDraw()
        }
    })

    stage.on("contentMouseup", function (event) {
        container.style.cursor = 'default'

        const startSquare = event.currentTarget.clickStartShape.attrs
        const endSquare = event.currentTarget.clickEndShape.attrs
        const firstXBefore = (endSquare.x >= startSquare.x)
        const firstYBefore = (endSquare.y >= startSquare.y)

        const firstX = firstXBefore ? startSquare.x : endSquare.x
        const secondX = firstXBefore ? endSquare.x : startSquare.x
        const firstY = firstYBefore ? startSquare.y : endSquare.y
        const secondY = firstYBefore ? endSquare.y : startSquare.y

        drag = false
        rect.height = 0
        rect.width = 0
        rect.x = 0
        rect.y = 0
        selection.setAttrs(merge(selectionOptions, rect))

        for (let yindex = firstY / 10; yindex <= secondY / 10; yindex++) {
            for (let xindex = firstX / 10; xindex <= secondX / 10; xindex++) {
                const isShift = event.evt.shiftKey
                const isAlt = event.evt.altKey
                window.dispatchEvent(
                    new CustomEvent('rectangle-click-' + xindex * 10 + '-' + yindex * 10, {
                        detail: isShift ? 'start' : isAlt ? 'empty' : 'block'
                    })
                )
            }
        }
    })

    const rects = row_arr.map((x) =>
        col_arr.map((y) => {
            const rect = new Konva.Rect({
                x: x,
                y: y,
                id: x + '-' + y,
                height: height / col_arr.length,
                width: width / row_arr.length,
                fill: 'rgba(0, 0, 0, 0)',
                stroke: 'black',
                strokeWidth: 1
            });
            window.addEventListener('rectangle-click-' + x + '-' + y, function (event) {
                const color = colors[event.detail]
                rect.setAttr('click', event.detail)
                rect.fill(color)
                layer.batchDraw()
            })
            layer.add(rect);
            return rect
        })
    )
    layer.add(selection);
    stage.add(layer);


    function sendData() {
        const backendUrl = 'http://localhost:5000/graph'
        const resultMatrix =
            rects.map((line) =>
                line.map((square) => {
                    const state = square.attrs
                    return [
                        state.y + '-' + state.x, //id
                        state.click === 'block' ? 0 : state.click === 'start' ? 2 : 1 //clicked
                    ]
                })
            )

        fetch(backendUrl, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                method: 'post',
                body: JSON.stringify({
                    nodes: resultMatrix
                })
            })
            .then(r => r.json())
            .then((result) => {
                console.log("received")
                console.log(result)
                result.forEach((line) => {
                    const id = line.split("-").reverse()
                    window.dispatchEvent(new CustomEvent('rectangle-click-' + id[0] + "-" + id[1], {
                        detail: 'path'
                    }))
                })
            })
            .catch((err) => {
                console.log(err)
            })
    }
    document.getElementById("send-data").addEventListener('click', sendData)
}




window.addEventListener('load', function () {
    const fileinput = document.getElementById("file_input_text")
    fileinput.addEventListener('change', function (e) {
        getBase64(fileinput.files[0]).then((file) => {
            readImage(file).then((img) => {
                makegrid()

            })
        })
    })
})