importScripts('./computedFileChunkHash.js')

// 接收信息
onmessage = async (e) => {
    const { file, CHUNK_SIZE, start, end, doneUploadChunkList, fileTaskMap, fileKey } = e.data

    let doneChunk = 0

    // 遍历每个线程的起始位置，即可获得线程内部的每个文件块
    for (let index = start; index < end; index++) {

        if (doneUploadChunkList.includes(index)) {
            console.info('已经有了~~~')
            doneChunk++
            const fileTask = fileTaskMap.get(fileKey)
            fileTask.chunkIndex = index
            fileTask.isUploaded = true
            fileTask.isDoneThread = doneChunk === end - start
            postMessage({
                fileTaskMap: fileTaskMap,
                fileKey: fileKey
            })
            continue
        }

        const chunkData = await computedFileChunkHash({
            file,
            index,
            CHUNK_SIZE,
            fileTaskMap,
            fileKey
        })

        // console.info(chunkData)

        doneChunk++

        if (doneChunk === end - start) chunkData.get(fileKey).isDoneThread = true

        // 分块文件计算完成之后直接传递给主线程
        postMessage({
            fileTaskMap: chunkData,
            fileKey: fileKey
        })
    }
}